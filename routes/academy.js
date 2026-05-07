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
const practicum = require('../services/academy/practicumStore');
const {
  parseDocumentText,
  chunkText,
  embedTextSimple,
  buildRetrieval,
  strictNoSourceMessage
} = require('../services/academy/knowledgeService');
const { randomUUID } = require('crypto');

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

/** When true, HTML artifacts may contain scripts (Angular/CDN). XSS risk — enable only in trusted environments. */
const ARTIFACT_ALLOW_SCRIPTS = process.env.ACADEMY_ARTIFACT_ALLOW_SCRIPTS === 'true';

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

  /**
   * Builds OpenRouter messages; truncates long assistant replies for token budget and drops
   * oldest turns until under MAX_CONTEXT_CHARS (CSV/HTML-heavy chats).
   */
  async function buildMessagesWithBudget(rows, lessonForPrompt, req) {
    const maxAssist = parseInt(process.env.MAX_ASSISTANT_CHARS_IN_CONTEXT || '42000', 10);
    let subset = [...rows];
    let droppedTurns = 0;

    async function rebuild() {
      const apiMessages = [];
      apiMessages.push({
        role: 'system',
        content: getMentorSystemPrompt({ lesson: lessonForPrompt })
      });
      let totalChars = estimatePayloadFootprintForLimits(apiMessages[0].content);
      for (const m of subset) {
        if (m.role !== 'user' && m.role !== 'assistant') continue;
        let content;
        if (m.role === 'user') {
          content = await buildUserContentForApi(m.content, req.dbUser.id, m.meta);
        } else {
          const raw = m.content || '';
          content =
            typeof raw === 'string' && raw.length > maxAssist
              ? raw.slice(0, maxAssist) +
                '\n\n[… предыдущий ответ обрезан в контексте (длинный отчёт/HTML); полный текст — в истории чата …]'
              : raw;
        }
        totalChars += estimatePayloadFootprintForLimits(content);
        apiMessages.push({ role: m.role, content });
      }
      return { apiMessages, totalChars };
    }

    let { apiMessages, totalChars } = await rebuild();
    while (totalChars > MAX_CONTEXT_CHARS && subset.length > 1) {
      subset = subset.slice(1);
      droppedTurns += 1;
      ({ apiMessages, totalChars } = await rebuild());
    }
    return { apiMessages, totalChars, droppedTurns };
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

  router.patch('/knowledge-bases/:id', authenticateAcademy, async (req, res) => {
    try {
      const kb = await db.getKnowledgeBaseForUser(req.dbUser.id, req.params.id);
      if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : null;
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
      if (name !== null && !name) {
        return res.status(400).json({ error: 'Knowledge base name cannot be empty' });
      }
      const updated = await db.updateKnowledgeBase(req.dbUser.id, kb.id, {
        name,
        description
      });
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update knowledge base' });
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

  router.get('/knowledge-bases/:id/documents/search', authenticateAcademy, async (req, res) => {
    try {
      const kb = await db.getKnowledgeBaseForUser(req.dbUser.id, req.params.id);
      if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
      const q = String(req.query.q || '').trim();
      if (!q) {
        const docs = await db.listKnowledgeDocuments(req.dbUser.id, kb.id);
        return res.json({ documents: docs });
      }
      const docs = await db.searchKnowledgeDocuments(req.dbUser.id, kb.id, q);
      res.json({ documents: docs });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to search documents' });
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

  router.get('/knowledge-documents/:id/download', authenticateAcademy, async (req, res) => {
    try {
      const doc = await db.getKnowledgeDocumentForUser(req.dbUser.id, req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      const abs = path.join(userUploadDir(req.dbUser.id), doc.stored_name);
      if (!fs.existsSync(abs)) {
        return res.status(404).json({ error: 'Stored file not found' });
      }
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      return res.download(abs, doc.original_name);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to download document' });
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
        model_catalog: getModelCatalog(),
        artifact_allow_scripts: ARTIFACT_ALLOW_SCRIPTS
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Usage unavailable' });
    }
  });

  router.get('/usage/education', authenticateAcademy, async (req, res) => {
    try {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const usageRows = await db.adminExportUsage(monthStart, monthEnd);
      const mine = usageRows.filter((r) => r.user_id === req.dbUser.id);
      const byModel = {};
      for (const r of mine) {
        if (!byModel[r.model]) byModel[r.model] = { model: r.model, tokens: 0, cost_usd: 0 };
        byModel[r.model].tokens += Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0);
        byModel[r.model].cost_usd += Number(r.cost_usd || 0);
      }
      const sorted = Object.values(byModel).sort((a, b) => b.cost_usd - a.cost_usd);
      const cheapest = sorted[sorted.length - 1] || null;
      const expensive = sorted[0] || null;
      res.json({
        by_model: sorted,
        guidance: [
          'Use concise prompts and shorter context when possible.',
          'Choose lower-cost models for drafting, expensive models for final pass.',
          'Use Knowledge Base retrieval to avoid re-sending large source texts.'
        ],
        cheapest_model: cheapest,
        expensive_model: expensive
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to build educational usage insights' });
    }
  });

  async function recordFeatureUsage(req, data) {
    await db.recordAiUsage({
      userId: req.dbUser.id,
      conversationId: data.conversationId || null,
      model: data.model,
      promptTokens: data.promptTokens || 0,
      completionTokens: data.completionTokens || 0,
      costUsd: data.costUsd || 0,
      featureMode: data.featureMode || 'chat_general'
    });
  }

  router.get('/knowledge-bases', authenticateAcademy, async (req, res) => {
    try {
      const bases = await practicum.listKnowledgeBases(req.dbUser.id);
      res.json({ knowledgeBases: bases });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load knowledge bases' });
    }
  });

  router.post('/knowledge-bases', authenticateAcademy, async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name required' });
      const kb = await practicum.createKnowledgeBase(req.dbUser.id, name, String(req.body?.description || ''));
      res.json(kb);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create knowledge base' });
    }
  });

  router.get('/knowledge-bases/:id/documents', authenticateAcademy, async (req, res) => {
    try {
      const docs = await practicum.listKnowledgeDocuments(req.dbUser.id, req.params.id);
      res.json({ documents: docs });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load documents' });
    }
  });

  router.post('/knowledge-bases/:id/documents/url', authenticateAcademy, async (req, res) => {
    try {
      const sourceUrl = String(req.body?.url || '').trim();
      if (!sourceUrl) return res.status(400).json({ error: 'url required' });
      const doc = await practicum.createKnowledgeDocument({
        knowledgeBaseId: req.params.id,
        userId: req.dbUser.id,
        name: sourceUrl,
        sourceType: 'url',
        sourceUrl,
        status: 'uploaded'
      });
      const job = await practicum.createIndexJob({
        userId: req.dbUser.id,
        knowledgeBaseId: req.params.id,
        documentId: doc.id
      });
      setImmediate(async () => {
        try {
          await practicum.setIndexJobStatus(job.id, 'processing');
          await practicum.clearChunksForDocument(doc.id);
          const text = await parseDocumentText(doc);
          const chunks = chunkText(text);
          let i = 0;
          for (const c of chunks) {
            await practicum.addKnowledgeChunk({
              documentId: doc.id,
              userId: req.dbUser.id,
              chunkIndex: i++,
              content: c,
              embedding: embedTextSimple(c)
            });
          }
          await practicum.updateKnowledgeDocument(doc.id, req.dbUser.id, { status: 'indexed', chunkCount: chunks.length });
          await practicum.setIndexJobStatus(job.id, 'indexed');
        } catch (err) {
          await practicum.updateKnowledgeDocument(doc.id, req.dbUser.id, { status: 'failed', errorMessage: err.message });
          await practicum.setIndexJobStatus(job.id, 'failed', err.message);
        }
      });
      res.json({ document: doc, job });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to add URL source' });
    }
  });

  router.post('/knowledge-bases/:id/documents/upload', authenticateAcademy, upload.array('files', MAX_FILES), async (req, res) => {
    try {
      if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
      const saved = persistMulterFiles(req.dbUser.id, req.files);
      const out = [];
      for (const f of saved) {
        const doc = await practicum.createKnowledgeDocument({
          knowledgeBaseId: req.params.id,
          userId: req.dbUser.id,
          name: f.name,
          mimeType: f.mime,
          sourceType: 'file',
          storagePath: f.path,
          status: 'uploaded'
        });
        const job = await practicum.createIndexJob({
          userId: req.dbUser.id,
          knowledgeBaseId: req.params.id,
          documentId: doc.id
        });
        out.push({ document: doc, job });
        setImmediate(async () => {
          try {
            await practicum.setIndexJobStatus(job.id, 'processing');
            await practicum.updateKnowledgeDocument(doc.id, req.dbUser.id, { status: 'processing' });
            await practicum.clearChunksForDocument(doc.id);
            const text = await parseDocumentText(doc);
            const chunks = chunkText(text);
            let i = 0;
            for (const c of chunks) {
              await practicum.addKnowledgeChunk({
                documentId: doc.id,
                userId: req.dbUser.id,
                chunkIndex: i++,
                content: c,
                embedding: embedTextSimple(c)
              });
            }
            await practicum.updateKnowledgeDocument(doc.id, req.dbUser.id, { status: 'indexed', chunkCount: chunks.length });
            await practicum.setIndexJobStatus(job.id, 'indexed');
          } catch (err) {
            await practicum.updateKnowledgeDocument(doc.id, req.dbUser.id, { status: 'failed', errorMessage: err.message });
            await practicum.setIndexJobStatus(job.id, 'failed', err.message);
          }
        });
      }
      res.json({ items: out });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  router.get('/personas', authenticateAcademy, async (req, res) => {
    const personas = await practicum.listPersonas(req.dbUser.id);
    res.json({ personas });
  });

  router.post('/personas', authenticateAcademy, async (req, res) => {
    const persona = await practicum.createPersona(req.dbUser.id, req.body || {});
    res.json(persona);
  });

  router.get('/prompts', authenticateAcademy, async (req, res) => {
    const prompts = await practicum.listPromptTemplates(req.dbUser.id, req.query.category || null);
    res.json({ prompts });
  });

  router.post('/prompts', authenticateAcademy, async (req, res) => {
    const prompt = await practicum.createPromptTemplate(req.dbUser.id, req.body || {});
    res.json(prompt);
  });

  router.patch('/prompts/:id', authenticateAcademy, async (req, res) => {
    const prompt = await practicum.updatePromptTemplate(req.dbUser.id, req.params.id, req.body || {});
    if (!prompt) return res.status(404).json({ error: 'prompt not found' });
    res.json(prompt);
  });

  router.post('/prompts/:id/duplicate', authenticateAcademy, async (req, res) => {
    const prompt = await practicum.duplicatePromptTemplate(req.dbUser.id, req.params.id);
    if (!prompt) return res.status(404).json({ error: 'prompt not found' });
    res.json(prompt);
  });

  router.post('/prompt-evaluate', authenticateAcademy, aiChatLimiter, async (req, res) => {
    const openai = createOpenRouterClient();
    const promptText = String(req.body?.prompt || '').trim();
    if (!promptText) return res.status(400).json({ error: 'prompt required' });
    const model = pickModel(req.body?.model, req.dbUser);
    await assertQuota(req, estimateTokensFromText(promptText));
    const evalPrompt = `Evaluate this prompt as teaching feedback.\nPrompt:\n${promptText}\n\nReturn JSON with: score(1-10), strengths[], weaknesses[], improved_prompt, explanation.`;
    const gen = streamChatCompletion(openai, {
      model,
      messages: [{ role: 'system', content: 'You are a prompt engineering tutor. Return compact JSON only.' }, { role: 'user', content: evalPrompt }],
      maxTokens: 800
    });
    let text = '';
    let usage = null;
    for await (const part of gen) {
      if (part.type === 'chunk') text += part.text;
      if (part.type === 'done') usage = part.usage;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { score: 6, strengths: ['Intent provided'], weaknesses: ['Output format unclear'], improved_prompt: promptText, explanation: text };
    }
    await recordFeatureUsage(req, {
      model,
      promptTokens: usage?.prompt_tokens || estimateTokensFromText(evalPrompt),
      completionTokens: usage?.completion_tokens || estimateTokensFromText(text),
      costUsd: estimateCostUsd(usage?.prompt_tokens || 0, usage?.completion_tokens || 0, model),
      featureMode: 'prompt_evaluation'
    });
    res.json(parsed);
  });

  router.post('/model-compare', authenticateAcademy, aiChatLimiter, async (req, res) => {
    const openai = createOpenRouterClient();
    const promptText = String(req.body?.prompt || '').trim();
    const models = Array.isArray(req.body?.models) ? req.body.models.slice(0, 4) : [];
    if (!promptText || !models.length) return res.status(400).json({ error: 'prompt and models required' });
    const results = [];
    for (const m of models) {
      const model = pickModel(m, req.dbUser);
      const started = Date.now();
      const gen = streamChatCompletion(openai, {
        model,
        messages: [{ role: 'user', content: promptText }],
        maxTokens: 1000
      });
      let text = '';
      let usage = null;
      for await (const part of gen) {
        if (part.type === 'chunk') text += part.text;
        if (part.type === 'done') usage = part.usage;
      }
      const latency = Date.now() - started;
      const pt = usage?.prompt_tokens || estimateTokensFromText(promptText);
      const ct = usage?.completion_tokens || estimateTokensFromText(text);
      const cost = estimateCostUsd(pt, ct, model);
      await recordFeatureUsage(req, {
        model,
        promptTokens: pt,
        completionTokens: ct,
        costUsd: cost,
        featureMode: 'model_compare'
      });
      results.push({
        model,
        response: text,
        latency_ms: latency,
        input_tokens: pt,
        output_tokens: ct,
        estimated_cost: cost,
        quality_note: text.length > 500 ? 'Detailed response with good coverage.' : 'Concise response.'
      });
    }
    res.json({ results });
  });

  router.post('/playground', authenticateAcademy, aiChatLimiter, async (req, res) => {
    const openai = createOpenRouterClient();
    const input = String(req.body?.prompt || '').trim();
    if (!input) return res.status(400).json({ error: 'prompt required' });
    const model = pickModel(req.body?.model, req.dbUser);
    const temperature = Number.isFinite(Number(req.body?.temperature)) ? Number(req.body.temperature) : 0.7;
    const topP = Number.isFinite(Number(req.body?.top_p)) ? Number(req.body.top_p) : 1;
    const maxTokens = Number.isFinite(Number(req.body?.max_tokens)) ? Number(req.body.max_tokens) : 1200;
    const systemPrompt = String(req.body?.system_prompt || 'You are a helpful assistant.');
    await assertQuota(req, estimateTokensFromText(input + systemPrompt));
    const gen = streamChatCompletion(openai, {
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: input }],
      maxTokens,
      temperature,
      topP
    });
    let text = '';
    let usage = null;
    for await (const part of gen) {
      if (part.type === 'chunk') text += part.text;
      if (part.type === 'done') usage = part.usage;
    }
    await recordFeatureUsage(req, {
      model,
      promptTokens: usage?.prompt_tokens || estimateTokensFromText(input + systemPrompt),
      completionTokens: usage?.completion_tokens || estimateTokensFromText(text),
      costUsd: estimateCostUsd(usage?.prompt_tokens || 0, usage?.completion_tokens || 0, model),
      featureMode: 'playground'
    });
    res.json({ response: text });
  });

  router.get('/assistants', authenticateAcademy, async (req, res) => {
    const assistants = await practicum.listAssistants(req.dbUser.id);
    res.json({ assistants });
  });

  router.post('/assistants', authenticateAcademy, async (req, res) => {
    const assistant = await practicum.createAssistant(req.dbUser.id, req.body || {});
    res.json(assistant);
  });

  router.patch('/assistants/:id', authenticateAcademy, async (req, res) => {
    const assistant = await practicum.updateAssistant(req.dbUser.id, req.params.id, req.body || {});
    if (!assistant) return res.status(404).json({ error: 'assistant not found' });
    res.json(assistant);
  });

  router.post('/assistants/:id/duplicate', authenticateAcademy, async (req, res) => {
    const assistant = await practicum.duplicateAssistant(req.dbUser.id, req.params.id);
    if (!assistant) return res.status(404).json({ error: 'assistant not found' });
    res.json(assistant);
  });

  router.delete('/assistants/:id', authenticateAcademy, async (req, res) => {
    const ok = await practicum.softDeleteAssistant(req.dbUser.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'assistant not found' });
    res.json({ ok: true });
  });

  router.post('/workflows', authenticateAcademy, async (req, res) => {
    const workflow = await practicum.createWorkflow(req.dbUser.id, req.body || {});
    for (const s of req.body?.steps || []) {
      await practicum.addWorkflowStep(workflow.id, s);
    }
    res.json(workflow);
  });

  router.post('/workflows/:id/run', authenticateAcademy, aiChatLimiter, async (req, res) => {
    const openai = createOpenRouterClient();
    const wf = await practicum.getWorkflowForUser(req.params.id, req.dbUser.id);
    if (!wf) return res.status(404).json({ error: 'workflow not found' });
    const steps = await practicum.listWorkflowSteps(wf.id);
    const run = await practicum.createWorkflowRun(wf.id, req.dbUser.id, String(req.body?.input || ''));
    let prev = String(req.body?.input || '');
    const outputs = [];
    try {
      for (const s of steps) {
        const filledPrompt = String(s.prompt_text || '').replace(/\{\{previous_output\}\}/g, prev);
        const model = pickModel(req.body?.model, req.dbUser);
        const gen = streamChatCompletion(openai, {
          model,
          messages: [{ role: 'user', content: filledPrompt }],
          maxTokens: 1000
        });
        let text = '';
        let usage = null;
        for await (const part of gen) {
          if (part.type === 'chunk') text += part.text;
          if (part.type === 'done') usage = part.usage;
        }
        await practicum.addWorkflowStepRun(run.id, s.id, text);
        await recordFeatureUsage(req, {
          model,
          promptTokens: usage?.prompt_tokens || estimateTokensFromText(filledPrompt),
          completionTokens: usage?.completion_tokens || estimateTokensFromText(text),
          costUsd: estimateCostUsd(usage?.prompt_tokens || 0, usage?.completion_tokens || 0, model),
          featureMode: 'workflow_builder'
        });
        outputs.push({ stepId: s.id, title: s.title, output: text });
        prev = text;
      }
      await practicum.finishWorkflowRun(run.id, 'completed');
    } catch (e) {
      await practicum.finishWorkflowRun(run.id, 'failed');
      throw e;
    }
    res.json({ runId: run.id, outputs });
  });

  router.get('/hallucination/scenarios', authenticateAcademy, async (req, res) => {
    const scenarios = await practicum.listHallucinationScenarios();
    res.json({ scenarios });
  });

  router.post('/hallucination/attempt', authenticateAcademy, async (req, res) => {
    const selectedIssue = String(req.body?.selected_issue || '');
    const explanation = String(req.body?.explanation || '');
    const score = explanation.length > 40 ? 10 : explanation.length > 10 ? 6 : 3;
    const attempt = await practicum.createHallucinationAttempt({
      scenarioId: req.body?.scenario_id,
      userId: req.dbUser.id,
      selectedIssue,
      explanation,
      score,
      feedback: score >= 8 ? 'Отлично: вы корректно нашли проблему и обосновали.' : 'Уточните тип ошибки и почему утверждение ненадежно.'
    });
    const progress = await practicum.getHallucinationProgress(req.dbUser.id);
    res.json({ attempt, progress: progress[0] || { attempts: 0, avg_score: 0 } });
  });

  router.post('/certificate', authenticateAcademy, async (req, res) => {
    const cert = await practicum.upsertCertificate({
      certificateId: req.body?.certificate_id || randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase(),
      userId: req.dbUser.id,
      userName: req.dbUser.name || req.dbUser.email,
      courseName: String(req.body?.course_name || 'AI Practicum'),
      completionDate: req.body?.completion_date || new Date().toISOString().slice(0, 10),
      completedModules: req.body?.completed_modules || []
    });
    res.json(cert);
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
        costUsd,
        featureMode: 'image_generation'
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
      const chatMode = String(body.chatMode || 'general');
      const knowledgeBaseId = body.knowledgeBaseId || null;
      const strictMode = body.strictMode === true || body.strictMode === 'true' || chatMode === 'strict_knowledge';
      const personaId = body.personaId || null;

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

        const lessonForPrompt = lesson || (conv.lesson_id ? await db.getLessonById(conv.lesson_id) : null);

        const { apiMessages, totalChars, droppedTurns } = await buildMessagesWithBudget(
          rows,
          lessonForPrompt,
          req
        );

        if (personaId) {
          const persona = await practicum.getPersonaForUser(personaId, req.dbUser.id);
          if (persona) {
            apiMessages.splice(1, 0, {
              role: 'system',
              content: `Persona: ${persona.name}\nTone: ${persona.tone}\nExpertise: ${persona.expertise}\nTeaching style: ${persona.teaching_style}\nInstructions:\n${persona.system_prompt}`
            });
          }
        }

        let retrievalCitations = [];
        let strictFallbackText = null;
        if ((chatMode === 'knowledge' || chatMode === 'strict_knowledge' || chatMode === 'agent_knowledge') && knowledgeBaseId) {
          const allChunks = await practicum.getChunksForKnowledgeBase(req.dbUser.id, knowledgeBaseId);
          const retrieved = buildRetrieval(message || 'last user message', allChunks, 5);
          retrievalCitations = retrieved.map((r, idx) => ({
            id: idx + 1,
            document: r.document_name,
            score: Number((r.score || 0).toFixed(3)),
            preview: String(r.content || '').slice(0, 220)
          }));
          if (!retrieved.length && strictMode) strictFallbackText = strictNoSourceMessage();
          if (retrieved.length) {
            const kbContext = retrieved
              .map((r, idx) => `[Source ${idx + 1}] ${r.document_name}\n${r.content}`)
              .join('\n\n');
            apiMessages.splice(1, 0, {
              role: 'system',
              content: `Knowledge base context (use as source of truth):\n${kbContext}\nAlways cite source numbers in the answer.`
            });
          }
        }

        if (droppedTurns > 0) {
          console.info(
            `[academy/chat] context shrink: dropped ${droppedTurns} oldest message(s), chars=${totalChars}`
          );
        }

        if (totalChars > MAX_CONTEXT_CHARS) {
          return res.status(400).json({
            error:
              'Контекст слишком большой даже после сжатия истории. Начните новый диалог или отправьте файл отдельным коротким чатом.'
          });
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

        if (strictFallbackText) {
          await db.addAiMessage(conversationId, 'assistant', strictFallbackText, {
            model,
            feature_mode: 'chat_strict_knowledge',
            citations: [],
            confidence: 'low'
          });
          await recordFeatureUsage(req, {
            conversationId,
            model,
            promptTokens: estTokens,
            completionTokens: estimateTokensFromText(strictFallbackText),
            costUsd: estimateCostUsd(estTokens, estimateTokensFromText(strictFallbackText), model),
            featureMode: 'chat_strict_knowledge'
          });
          send({ type: 'chunk', text: strictFallbackText });
          send({ type: 'done', conversationId, citations: [], confidence: 'low' });
          res.end();
          return;
        }

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
          mentor_prompt_version: MENTOR_PROMPT_VERSION,
          feature_mode:
            chatMode === 'knowledge'
              ? 'chat_knowledge'
              : chatMode === 'strict_knowledge'
                ? 'chat_strict_knowledge'
                : chatMode === 'agent_knowledge'
                  ? 'chat_agent_knowledge'
                  : 'chat_general',
          citations: retrievalCitations,
          confidence: retrievalCitations.length ? 'medium' : 'low'
        };
        await db.addAiMessage(conversationId, 'assistant', fullAssistant || ' ', meta);

        let promptTokens = finalUsage?.prompt_tokens ?? estimateTokensFromText(JSON.stringify(apiMessages));
        let completionTokens = finalUsage?.completion_tokens ?? estimateTokensFromText(fullAssistant);
        const costFromApi = finalUsage?.total_cost ?? finalUsage?.cost;
        let costUsd =
          typeof costFromApi === 'number'
            ? costFromApi
            : estimateCostUsd(promptTokens, completionTokens, model);

        await recordFeatureUsage(req, {
          conversationId,
          model,
          promptTokens,
          completionTokens,
          costUsd,
          featureMode: meta.feature_mode
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
          citations: retrievalCitations,
          confidence: retrievalCitations.length ? 'medium' : 'low',
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
