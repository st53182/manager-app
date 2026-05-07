const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const { getMentorSystemPrompt, MENTOR_PROMPT_VERSION } = require('../prompts/mentorPrompt');
const { createOpenRouterClient, getDefaultModel } = require('../services/ai/openRouterClient');
const { streamChatCompletion, estimateTokensFromText, estimateCostUsd } = require('../services/ai/streamChat');
const {
  persistMulterFiles,
  buildUserContentForApi,
  estimatePayloadFootprintForLimits,
  userUploadDir,
  MAX_FILES,
  MAX_FILE_BYTES
} = require('../services/academy/multimodal');
const { getModelCatalog } = require('../services/academy/modelCatalog');
const { generateImageForEducation, getImageModel } = require('../services/ai/imageGeneration');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES }
});

const FALLBACK_DAILY_TOKENS = parseInt(process.env.DEFAULT_AI_DAILY_TOKEN_LIMIT || '2000000', 10);
const FALLBACK_MONTHLY_TOKENS = parseInt(process.env.DEFAULT_AI_MONTHLY_TOKEN_LIMIT || '60000000', 10);

const MAX_PROMPT_CHARS = parseInt(process.env.MAX_PROMPT_CHARS || '32000', 10);
const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES || '40', 10);
/** Soft guard; PDF/audio/video base64 is capped in footprint calculation (see multimodal). */
const MAX_CONTEXT_CHARS = parseInt(process.env.MAX_CONTEXT_CHARS || '500000', 10);

function createRouter({ JWT_SECRET }) {
  const router = express.Router();

  const aiChatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.AI_CHAT_RATE_LIMIT_PER_MIN || '30', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests, please slow down.' }
  });

  function authenticateAcademy(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    jwt.verify(token, JWT_SECRET, async (err, payload) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = payload;
      try {
        const row = await db.getUserById(payload.userId);
        if (!row) return res.status(403).json({ error: 'User not found' });
        if (!row.is_active) return res.status(403).json({ error: 'Account disabled' });
        req.dbUser = row;
        next();
      } catch (e) {
        return res.status(500).json({ error: 'Auth failed' });
      }
    });
  }

  router.get('/catalog', authenticateAcademy, async (req, res) => {
    try {
      const catalog = await db.getAcademyCatalog();
      const progress = await db.getLessonProgressForUser(req.dbUser.id);
      const progressMap = {};
      for (const p of progress) progressMap[p.lesson_id] = p;
      res.json({ ...catalog, progress: progressMap });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load catalog' });
    }
  });

  router.post('/progress', authenticateAcademy, async (req, res) => {
    try {
      const { lessonId, status, score } = req.body;
      if (!lessonId || !status) {
        return res.status(400).json({ error: 'lessonId and status required' });
      }
      await db.upsertLessonProgress(req.dbUser.id, lessonId, { status, score });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to save progress' });
    }
  });

  router.get('/knowledge-bases', authenticateAcademy, async (req, res) => {
    try {
      const bases = await db.listKnowledgeBases(req.dbUser.id);
      res.json({ knowledgeBases: bases });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load knowledge bases' });
    }
  });

  router.post('/knowledge-bases', authenticateAcademy, async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const description = String(req.body?.description || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Knowledge base name is required' });
      }
      const kb = await db.createKnowledgeBase(req.dbUser.id, {
        name,
        description: description || null
      });
      res.json(kb);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create knowledge base' });
    }
  });

  router.delete('/knowledge-bases/:id', authenticateAcademy, async (req, res) => {
    try {
      const kb = await db.getKnowledgeBaseForUser(req.dbUser.id, req.params.id);
      if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

      const docs = await db.listKnowledgeDocuments(req.dbUser.id, kb.id);
      for (const d of docs) {
        if (!d.stored_name) continue;
        const abs = path.join(userUploadDir(req.dbUser.id), d.stored_name);
        if (fs.existsSync(abs)) {
          try {
            fs.unlinkSync(abs);
          } catch (unlinkErr) {
            console.warn('Failed to remove document file:', unlinkErr.message);
          }
        }
      }

      await db.deleteKnowledgeBase(req.dbUser.id, kb.id);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete knowledge base' });
    }
  });

  router.get('/knowledge-bases/:id/documents', authenticateAcademy, async (req, res) => {
    try {
      const kb = await db.getKnowledgeBaseForUser(req.dbUser.id, req.params.id);
      if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
      const docs = await db.listKnowledgeDocuments(req.dbUser.id, kb.id);
      res.json({ documents: docs });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load documents' });
    }
  });

  router.post(
    '/knowledge-bases/:id/documents',
    authenticateAcademy,
    upload.array('files', MAX_FILES),
    async (req, res) => {
      try {
        const kb = await db.getKnowledgeBaseForUser(req.dbUser.id, req.params.id);
        if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
        if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one file' });

        const saved = persistMulterFiles(req.dbUser.id, req.files);
        const created = [];
        for (let i = 0; i < saved.length; i += 1) {
          const item = saved[i];
          const source = (req.files || [])[i];
          created.push(
            await db.addKnowledgeDocument(req.dbUser.id, kb.id, {
              ...item,
              sizeBytes: source?.size || 0
            })
          );
        }
        res.json({ documents: created });
      } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message || 'Failed to upload documents' });
      }
    }
  );

  router.delete('/knowledge-documents/:id', authenticateAcademy, async (req, res) => {
    try {
      const doc = await db.getKnowledgeDocumentForUser(req.dbUser.id, req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      if (doc.stored_name) {
        const abs = path.join(userUploadDir(req.dbUser.id), doc.stored_name);
        if (fs.existsSync(abs)) {
          try {
            fs.unlinkSync(abs);
          } catch (unlinkErr) {
            console.warn('Failed to remove document file:', unlinkErr.message);
          }
        }
      }
      await db.deleteKnowledgeDocument(req.dbUser.id, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  router.get('/usage', authenticateAcademy, async (req, res) => {
    try {
      const u = req.dbUser;
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      const dayU = await db.sumAiTokensForUser(u.id, dayStart, dayEnd);
      const monthU = await db.sumAiTokensForUser(u.id, monthStart, monthEnd);

      const dailyLimit = u.ai_daily_token_limit ?? FALLBACK_DAILY_TOKENS;
      const monthlyLimit = u.ai_monthly_token_limit ?? FALLBACK_MONTHLY_TOKENS;
      let allowedModels = ['openai/gpt-4o-mini'];
      try {
        allowedModels = typeof u.ai_allowed_models === 'string'
          ? JSON.parse(u.ai_allowed_models)
          : u.ai_allowed_models || allowedModels;
      } catch (_) {}

      const usedDay = Number(dayU.prompt_tokens) + Number(dayU.completion_tokens);
      const usedMonth = Number(monthU.prompt_tokens) + Number(monthU.completion_tokens);

      res.json({
        daily: {
          used_tokens: usedDay,
          prompt_tokens: Number(dayU.prompt_tokens),
          completion_tokens: Number(dayU.completion_tokens),
          limit_tokens: dailyLimit,
          cost_usd: Number(dayU.cost_usd)
        },
        monthly: {
          used_tokens: usedMonth,
          prompt_tokens: Number(monthU.prompt_tokens),
          completion_tokens: Number(monthU.completion_tokens),
          limit_tokens: monthlyLimit,
          cost_usd: Number(monthU.cost_usd)
        },
        allowed_models: allowedModels,
        default_model: getDefaultModel(),
        model_catalog: getModelCatalog()
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Usage unavailable' });
    }
  });

  router.get('/conversations', authenticateAcademy, async (req, res) => {
    try {
      const rows = await db.listAiConversations(req.dbUser.id, 80);
      res.json({ conversations: rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  });

  router.post('/conversations', authenticateAcademy, async (req, res) => {
    try {
      const { lessonId, courseId, title, model } = req.body;
      const conv = await db.createAiConversation(req.dbUser.id, {
        lessonId: lessonId || null,
        courseId: courseId || null,
        title: title || 'New chat',
        model: model || getDefaultModel()
      });
      res.json(conv);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  router.get('/conversations/:id', authenticateAcademy, async (req, res) => {
    try {
      const conv = await db.getAiConversationForUser(req.params.id, req.dbUser.id);
      if (!conv) return res.status(404).json({ error: 'Not found' });
      const messages = await db.listAiMessagesAsc(conv.id, 500);
      res.json({ conversation: conv, messages });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load conversation' });
    }
  });

  router.patch('/conversations/:id', authenticateAcademy, async (req, res) => {
    try {
      const { title, model } = req.body;
      const updated = await db.updateAiConversation(req.dbUser.id, req.params.id, { title, model });
      if (!updated) return res.status(404).json({ error: 'Not found' });
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  router.delete('/conversations/:id', authenticateAcademy, async (req, res) => {
    try {
      const ok = await db.deleteAiConversation(req.dbUser.id, req.params.id);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  /**
   * Генерация изображений (отдельная модель + modalities). Обычный /chat только текст.
   */
  router.post('/image/generate', authenticateAcademy, aiChatLimiter, async (req, res) => {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const { prompt, conversationId: incomingConvId, lessonId, courseId } = req.body || {};
    const text = prompt != null ? String(prompt).trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'Введите описание изображения' });
    }
    if (text.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({ error: `Текст слишком длинный (макс. ${MAX_PROMPT_CHARS})` });
    }

    const imgModel = getImageModel();

    try {
      await assertQuota(req, 16000);

      let conversationId = incomingConvId;
      let lesson = null;
      if (lessonId) {
        lesson = await db.getLessonById(lessonId);
      }

      if (!conversationId) {
        const conv = await db.createAiConversation(req.dbUser.id, {
          lessonId: lesson?.id || lessonId || null,
          courseId: courseId || lesson?.course_id || null,
          title: text.slice(0, 80) + (text.length > 80 ? '…' : ''),
          model: imgModel
        });
        conversationId = conv.id;
      }

      const conv = await db.getAiConversationForUser(conversationId, req.dbUser.id);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      await db.addAiMessage(conversationId, 'user', `🖼 Запрос изображения:\n${text}`, {
        kind: 'image_prompt'
      });

      let result;
      try {
        result = await generateImageForEducation(text);
      } catch (genErr) {
        console.error('Image generation failed:', genErr.message || genErr);
        await db.addAiMessage(
          conversationId,
          'assistant',
          `Не удалось сгенерировать изображение. ${String(genErr.message || genErr).slice(0, 500)}`,
          { model: imgModel, error: true }
        );
        return res.status(502).json({
          error: genErr.message || 'Генерация не удалась',
          conversationId
        });
      }

      await db.addAiMessage(conversationId, 'assistant', result.markdown, {
        model: imgModel,
        mentor_prompt_version: MENTOR_PROMPT_VERSION,
        image_generation: true,
        images: result.images
      });

      const u = result.usage;
      const pt = Number(u?.prompt_tokens) || estimateTokensFromText(text);
      const ct = Number(u?.completion_tokens) || 2500;
      const costFromApi = u?.total_cost ?? u?.cost;
      const costUsd =
        typeof costFromApi === 'number'
          ? costFromApi
          : estimateCostUsd(pt, ct, imgModel);

      await db.recordAiUsage({
        userId: req.dbUser.id,
        conversationId,
        model: imgModel,
        promptTokens: pt,
        completionTokens: ct,
        costUsd
      });

      let autoTitle;
      if (!conv.title || conv.title === 'New chat') {
        autoTitle = text.slice(0, 80) + (text.length > 80 ? '…' : '');
      }
      await db.updateAiConversation(req.dbUser.id, conversationId, {
        title: autoTitle,
        model: imgModel
      });

      res.json({
        ok: true,
        conversationId,
        model: imgModel,
        usage: {
          prompt_tokens: pt,
          completion_tokens: ct,
          cost_usd: costUsd
        }
      });
    } catch (e) {
      if (e.message === 'DAILY_LIMIT') {
        return res.status(429).json({ error: 'Daily token limit reached' });
      }
      if (e.message === 'MONTHLY_LIMIT') {
        return res.status(429).json({ error: 'Monthly token limit reached' });
      }
      console.error(e);
      res.status(500).json({ error: e.message || 'Image route failed' });
    }
  });

  function pickModel(reqBodyModel, dbUser) {
    const def = getDefaultModel();
    const requested = reqBodyModel || def;
    let allowed = [def];
    try {
      allowed = typeof dbUser.ai_allowed_models === 'string'
        ? JSON.parse(dbUser.ai_allowed_models)
        : dbUser.ai_allowed_models || allowed;
    } catch (_) {}
    if (!Array.isArray(allowed)) allowed = [def];
    if (!allowed.includes(requested)) return allowed[0];
    return requested;
  }

  async function assertQuota(req, estimatedPromptTokens = 0) {
    const u = req.dbUser;
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const dayU = await db.sumAiTokensForUser(u.id, dayStart, dayEnd);
    const monthU = await db.sumAiTokensForUser(u.id, monthStart, monthEnd);

    const dailyLimit = u.ai_daily_token_limit ?? FALLBACK_DAILY_TOKENS;
    const monthlyLimit = u.ai_monthly_token_limit ?? FALLBACK_MONTHLY_TOKENS;

    const usedDay = Number(dayU.prompt_tokens) + Number(dayU.completion_tokens);
    const usedMonth = Number(monthU.prompt_tokens) + Number(monthU.completion_tokens);

    if (usedDay + estimatedPromptTokens > dailyLimit) {
      const err = new Error('DAILY_LIMIT');
      err.status = 429;
      throw err;
    }
    if (usedMonth + estimatedPromptTokens > monthlyLimit) {
      const err = new Error('MONTHLY_LIMIT');
      err.status = 429;
      throw err;
    }
  }

  router.post(
    '/chat',
    authenticateAcademy,
    aiChatLimiter,
    (req, res, next) => {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('multipart/form-data')) {
        return upload.array('files', MAX_FILES)(req, res, (err) => {
          if (err) {
            return res.status(400).json({ error: err.message || 'Ошибка загрузки файлов' });
          }
          next();
        });
      }
      next();
    },
    async (req, res) => {
      const openai = createOpenRouterClient();
      if (!openai) {
        return res.status(503).json({ error: 'AI service not configured' });
      }

      const body = req.body || {};
      const incomingConvId = body.conversationId;
      const lessonId = body.lessonId;
      const courseId = body.courseId;
      const message = body.message != null ? String(body.message) : '';
      const regenerate = body.regenerate === true || body.regenerate === 'true';
      const bodyModel = body.model;

      let savedFiles = [];
      if (!regenerate && req.files?.length) {
        try {
          savedFiles = persistMulterFiles(req.dbUser.id, req.files);
        } catch (e) {
          return res.status(400).json({ error: e.message || 'Файлы не сохранены' });
        }
      }

      if (regenerate && !incomingConvId) {
        return res.status(400).json({ error: 'conversationId required for regenerate' });
      }
      if (!regenerate && !message.trim() && !savedFiles.length) {
        return res.status(400).json({ error: 'Нужен текст сообщения или хотя бы один файл' });
      }

      try {
        let conversationId = incomingConvId;
        let lesson = null;
        if (lessonId) {
          lesson = await db.getLessonById(lessonId);
        }

        if (!conversationId) {
          let title = 'New chat';
          if (!regenerate && message.trim()) {
            title = String(message).slice(0, 80) + (String(message).length > 80 ? '…' : '');
          } else if (!regenerate && savedFiles.length) {
            title = savedFiles[0].name.slice(0, 80) + (savedFiles[0].name.length > 80 ? '…' : '');
          }
          const conv = await db.createAiConversation(req.dbUser.id, {
            lessonId: lesson?.id || lessonId || null,
            courseId: courseId || lesson?.course_id || null,
            title,
            model: pickModel(bodyModel, req.dbUser)
          });
          conversationId = conv.id;
        }

        const conv = await db.getAiConversationForUser(conversationId, req.dbUser.id);
        if (!conv) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        const model = pickModel(bodyModel || conv.model, req.dbUser);

        if (regenerate) {
          await db.deleteLastAssistantMessage(conversationId);
        } else {
          if (message.trim() && String(message).length > MAX_PROMPT_CHARS) {
            return res.status(400).json({ error: `Message too long (max ${MAX_PROMPT_CHARS} chars)` });
          }
          const userMeta = savedFiles.length ? { files: savedFiles } : {};
          await db.addAiMessage(conversationId, 'user', message.trim(), userMeta);
        }

        let rows = await db.listAiMessagesAsc(conversationId, 500);
        rows = rows.slice(-MAX_CONTEXT_MESSAGES);

        let totalChars = 0;
        const apiMessages = [];
        const lessonForPrompt = lesson || (conv.lesson_id ? await db.getLessonById(conv.lesson_id) : null);
        apiMessages.push({
          role: 'system',
          content: getMentorSystemPrompt({ lesson: lessonForPrompt })
        });

        for (const m of rows) {
          if (m.role !== 'user' && m.role !== 'assistant') continue;
          let content;
          if (m.role === 'user') {
            content = await buildUserContentForApi(m.content, req.dbUser.id, m.meta);
          } else {
            content = m.content;
          }
          totalChars += estimatePayloadFootprintForLimits(content);
          apiMessages.push({ role: m.role, content });
        }

        if (totalChars > MAX_CONTEXT_CHARS) {
          return res.status(400).json({ error: 'Context too large. Start a new chat or shorten messages.' });
        }

        const estTokens = estimateTokensFromText(JSON.stringify(apiMessages));
        await assertQuota(req, estTokens);

        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        const send = (obj) => {
          res.write(`data: ${JSON.stringify(obj)}\n\n`);
        };

        send({ type: 'start', conversationId, model });

        let finalUsage = null;
        let fullAssistant = '';

        try {
          const gen = streamChatCompletion(openai, {
            model,
            messages: apiMessages,
            maxTokens: 4096
          });

          for await (const part of gen) {
            if (part.type === 'chunk') {
              fullAssistant += part.text;
              send({ type: 'chunk', text: part.text });
            }
            if (part.type === 'done') {
              finalUsage = part.usage;
              if (part.fullText) fullAssistant = part.fullText;
            }
          }
        } catch (streamErr) {
          console.error('Stream error:', streamErr.message || streamErr);
          send({ type: 'error', error: 'AI provider error. Try again.' });
          res.end();
          return;
        }

        const meta = {
          model,
          mentor_prompt_version: MENTOR_PROMPT_VERSION
        };
        await db.addAiMessage(conversationId, 'assistant', fullAssistant || ' ', meta);

        let promptTokens = finalUsage?.prompt_tokens ?? estimateTokensFromText(JSON.stringify(apiMessages));
        let completionTokens = finalUsage?.completion_tokens ?? estimateTokensFromText(fullAssistant);
        const costFromApi = finalUsage?.total_cost ?? finalUsage?.cost;
        let costUsd =
          typeof costFromApi === 'number'
            ? costFromApi
            : estimateCostUsd(promptTokens, completionTokens, model);

        await db.recordAiUsage({
          userId: req.dbUser.id,
          conversationId,
          model,
          promptTokens,
          completionTokens,
          costUsd
        });

        let autoTitle;
        if (!regenerate && (!conv.title || conv.title === 'New chat')) {
          if (message.trim()) {
            autoTitle = String(message).slice(0, 80) + (String(message).length > 80 ? '…' : '');
          } else if (savedFiles.length) {
            autoTitle = savedFiles[0].name.slice(0, 80) + (savedFiles[0].name.length > 80 ? '…' : '');
          }
        }
        await db.updateAiConversation(req.dbUser.id, conversationId, {
          title: autoTitle,
          model
        });

        send({
          type: 'done',
          conversationId,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            cost_usd: costUsd
          }
        });
        res.end();
      } catch (e) {
        if (e.message === 'DAILY_LIMIT') {
          return res.status(429).json({ error: 'Daily token limit reached' });
        }
        if (e.message === 'MONTHLY_LIMIT') {
          return res.status(429).json({ error: 'Monthly token limit reached' });
        }
        console.error(e);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Chat failed' });
        }
      }
    }
  );

  return router;
}

module.exports = { createRouter };
