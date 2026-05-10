const fs = require('fs');
const path = require('path');

const MAX_FILE_BYTES = parseInt(process.env.ACADEMY_MAX_FILE_MB || '25', 10) * 1024 * 1024;
const MAX_FILES = parseInt(process.env.ACADEMY_MAX_FILES_PER_MESSAGE || '8', 10);

/** Max characters injected for CSV/TSV/JSON/plain previews (token economy). */
const MAX_TABULAR_CHARS = parseInt(process.env.ACADEMY_MAX_TABULAR_CHARS || '80000', 10);
const TABULAR_PREVIEW_ROWS = parseInt(process.env.ACADEMY_TABULAR_PREVIEW_ROWS || '80', 10);
const TABULAR_TAIL_ROWS = parseInt(process.env.ACADEMY_TABULAR_TAIL_ROWS || '25', 10);
const MAX_PLAIN_TEXT_CHARS = parseInt(process.env.ACADEMY_MAX_PLAIN_TEXT_CHARS || '80000', 10);

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'text/tab-separated-values',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

function uploadsRoot() {
  const configured = process.env.ACADEMY_UPLOADS_ROOT;
  if (configured && String(configured).trim()) {
    return path.resolve(String(configured).trim());
  }
  return path.join(__dirname, '..', '..', 'uploads', 'academy');
}

function userUploadDir(userId) {
  return path.join(uploadsRoot(), String(userId));
}

function sanitizeStoredName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

function mimeToAudioFormat(mime) {
  const m = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/webm': 'ogg'
  };
  return m[mime] || 'mp3';
}

function assertSafeStoredName(stored) {
  if (!stored || stored.includes('..') || stored.includes('/') || stored.includes('\\')) {
    throw new Error('Invalid file reference');
  }
}

/**
 * OpenRouter/gpt-4o-mini often ignores chat `file` PDF parts; Gemini handles them.
 * For these models we never send native PDF — only server-extracted text (any length).
 * Extend via ACADEMY_PDF_TEXT_ONLY_MODELS=comma,separated,model,ids
 */
function shouldForcePdfAsPlainText(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  const extra = String(process.env.ACADEMY_PDF_TEXT_ONLY_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = ['openai/gpt-4o-mini'];
  const ids = new Set([...defaults, ...extra]);
  if (ids.has(modelId)) return true;
  if (modelId.includes('gpt-4o-mini')) return true;
  return false;
}

function looksLikeDelimitedTable(raw) {
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0).slice(0, 20);
  if (lines.length < 4) return false;
  let commas = 0;
  let tabs = 0;
  let semis = 0;
  for (const line of lines) {
    commas += (line.match(/,/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
    semis += (line.match(/;/g) || []).length;
  }
  const strong = Math.max(commas, tabs, semis);
  return strong >= lines.length * 2;
}

/**
 * Reduce CSV/TSV-like files to head + tail rows so long chats still fit context limits.
 */
function compactDelimitedText(raw, originalName) {
  const lines = raw.split(/\r?\n/);
  const nonempty = lines.filter((l) => l.trim().length > 0);
  const header = nonempty[0] || '';
  const dataLines = nonempty.slice(1);
  const totalData = dataLines.length;

  if (totalData <= TABULAR_PREVIEW_ROWS + TABULAR_TAIL_ROWS + 5 && raw.length <= MAX_TABULAR_CHARS) {
    return `[Вложение: ${originalName}]\n${raw}`;
  }

  const head = dataLines.slice(0, TABULAR_PREVIEW_ROWS);
  const tail =
    totalData > TABULAR_PREVIEW_ROWS + TABULAR_TAIL_ROWS
      ? dataLines.slice(-TABULAR_TAIL_ROWS)
      : [];
  const omitted =
    tail.length > 0 ? Math.max(0, totalData - head.length - tail.length) : 0;

  let sample =
    `[Вложение (выборка строк для экономии контекста): ${originalName}]\n` +
    `Всего строк данных: ${totalData}. Включены первые ${head.length}` +
    (tail.length ? ` и последние ${tail.length} строк.` : '.') +
    (omitted > 0 ? ` Пропущено средних строк: ${omitted}.` : '') +
    `\n\nПервая строка:\n${header}\n\n--- начало ---\n${head.join('\n')}\n`;

  if (tail.length) {
    sample += `\n--- … … ---\n\n--- конец ---\n${tail.join('\n')}\n`;
  }

  sample +=
    '\n\nИспользуй выборку для анализа и отчёта. Для расчётов по всем строкам пользователь может начать новый короткий диалог только с файлом.';

  if (sample.length > MAX_TABULAR_CHARS) {
    sample = sample.slice(0, MAX_TABULAR_CHARS) + '\n\n[… обрезано ACADEMY_MAX_TABULAR_CHARS …]';
  }
  return sample;
}

function compactJsonBuffer(buf, originalName) {
  const text = buf.toString('utf8');
  if (text.length <= MAX_TABULAR_CHARS) {
    return `[Вложение JSON: ${originalName}]\n${text}`;
  }
  try {
    const obj = JSON.parse(text);
    const pretty = JSON.stringify(obj, null, 2);
    if (pretty.length <= MAX_TABULAR_CHARS) {
      return `[Вложение JSON: ${originalName}]\n${pretty}`;
    }
    return (
      `[Вложение JSON (обрезано): ${originalName}]\n${pretty.slice(0, MAX_TABULAR_CHARS)}\n\n[… обрезано для лимита контекста …]`
    );
  } catch {
    return (
      `[Вложение: ${originalName}]\n${text.slice(0, MAX_TABULAR_CHARS)}\n\n[… не JSON или обрезано …]`
    );
  }
}

/**
 * Build one OpenRouter content part from a saved file (async: PDF may use text extraction).
 * ACADEMY_PDF_MODE=text_first (default) | native — native = всегда отправлять PDF как file (дороже).
 */
async function buildContentPartFromFile(absPath, mime, originalName, options = {}) {
  const modelId = options.model;
  const buf = fs.readFileSync(absPath);
  if (buf.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
  }
  const b64 = buf.toString('base64');

  if (mime.startsWith('image/')) {
    return {
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${b64}` }
    };
  }

  if (mime === 'application/pdf') {
    const pdfMode = process.env.ACADEMY_PDF_MODE || 'text_first';
    const minChars = parseInt(process.env.ACADEMY_PDF_MIN_TEXT_CHARS || '80', 10);
    const maxChars = parseInt(process.env.ACADEMY_MAX_PDF_TEXT_CHARS || '80000', 10);
    const forceTextPdf = shouldForcePdfAsPlainText(modelId);

    if (forceTextPdf) {
      try {
        const { extractPdfText } = require('./pdfText');
        const { text: rawText, numpages } = await extractPdfText(buf);
        let body = rawText.replace(/\s+/g, ' ').trim();
        if (body.length > maxChars) {
          body =
            body.slice(0, maxChars) +
            '\n\n[… фрагмент обрезан (ACADEMY_MAX_PDF_TEXT_CHARS), чтобы уложиться в лимит токенов …]';
        }
        if (body.length > 0) {
          const shortNote =
            body.length < minChars
              ? `\n\n[Внимание: извлечено мало текста (${body.length} симв.) — возможно скан; для разбора PDF «как файла» выберите модель Gemini или Claude с мультимодальностью.]\n\n`
              : '\n\n';
          return {
            type: 'text',
            text:
              `[PDF «${originalName || 'документ.pdf'}», ~${numpages} стр. Текст извлечён на сервере (совместимость с выбранной моделью).]${shortNote}${body}`
          };
        }
        return {
          type: 'text',
          text:
            `[PDF «${originalName || 'документ.pdf'}»] Текст не извлечён (часто у сканов). Эта модель не получает нативный PDF в чате — загрузите документ в базу знаний, приложите текстовый PDF или выберите модель Gemini.`
        };
      } catch (e) {
        console.warn('PDF text extraction failed (text-only model path):', e.message);
        return {
          type: 'text',
          text:
            `[PDF «${originalName || 'документ.pdf'}»] Ошибка извлечения: ${e.message}. Попробуйте модель Gemini или загрузите файл в базу знаний.`
        };
      }
    }

    if (pdfMode !== 'native') {
      try {
        const { extractPdfText } = require('./pdfText');
        const { text: rawText, numpages } = await extractPdfText(buf);
        let body = rawText.replace(/\s+/g, ' ').trim();
        if (body.length >= minChars) {
          if (body.length > maxChars) {
            body =
              body.slice(0, maxChars) +
              '\n\n[… фрагмент обрезан (ACADEMY_MAX_PDF_TEXT_CHARS), чтобы уложиться в лимит токенов …]';
          }
          return {
            type: 'text',
            text:
              `[PDF «${originalName || 'документ.pdf'}», ~${numpages} стр. Текст извлечён на сервере — меньше токенов, чем отправка файла целиком.]\n\n` +
              body
          };
        }
      } catch (e) {
        console.warn('PDF text extraction failed, falling back to native PDF:', e.message);
      }
    }

    return {
      type: 'file',
      file: {
        filename: originalName || 'document.pdf',
        file_data: `data:application/pdf;base64,${b64}`
      }
    };
  }

  if (mime.startsWith('audio/')) {
    return {
      type: 'input_audio',
      input_audio: {
        data: b64,
        format: mimeToAudioFormat(mime)
      }
    };
  }

  if (mime.startsWith('video/')) {
    return {
      type: 'video_url',
      video_url: { url: `data:${mime};base64,${b64}` }
    };
  }

  if (mime === 'text/csv' || mime === 'text/tab-separated-values') {
    const text = buf.toString('utf8');
    const body = compactDelimitedText(text, originalName || 'file.csv');
    return { type: 'text', text: body };
  }

  if (mime === 'application/json') {
    const body = compactJsonBuffer(buf, originalName || 'file.json');
    return { type: 'text', text: body };
  }

  if (mime === 'text/plain') {
    const text = buf.toString('utf8');
    if (looksLikeDelimitedTable(text)) {
      return {
        type: 'text',
        text: compactDelimitedText(text, originalName || 'file.txt')
      };
    }
    if (text.length > MAX_PLAIN_TEXT_CHARS) {
      return {
        type: 'text',
        text:
          `[Вложение (обрезано): ${originalName || 'file.txt'}]\n` +
          text.slice(0, MAX_PLAIN_TEXT_CHARS) +
          '\n\n[… ACADEMY_MAX_PLAIN_TEXT_CHARS …]'
      };
    }
    return {
      type: 'text',
      text: `[Вложение: ${originalName || 'file'}]\n${text}`
    };
  }

  throw new Error(`Unsupported file type: ${mime}`);
}

function validateMime(mime) {
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`Тип файла не разрешён: ${mime}`);
  }
}

/**
 * Save multer memory files → disk + metadata for ai_messages.meta.files
 */
function persistMulterFiles(userId, multerFiles) {
  if (!multerFiles?.length) return [];
  if (multerFiles.length > MAX_FILES) {
    throw new Error(`Максимум ${MAX_FILES} файлов за сообщение`);
  }
  const dir = userUploadDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  for (const f of multerFiles) {
    validateMime(f.mimetype);
    const buf = f.buffer;
    if (!buf || buf.length > MAX_FILE_BYTES) {
      throw new Error(`Файл слишком большой (макс. ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
    }
    const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${sanitizeStoredName(f.originalname)}`;
    const absPath = path.join(dir, stored);
    fs.writeFileSync(absPath, buf);
    saved.push({
      stored,
      name: f.originalname || stored,
      mime: f.mimetype,
      path: absPath
    });
  }
  return saved;
}

/**
 * Build message content for OpenRouter: string or multimodal array.
 */
async function buildUserContentForApi(text, userId, meta, modelId) {
  const t = (text || '').trim();
  let m = meta;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      m = {};
    }
  }
  const files = m?.files;
  if (!files?.length) {
    return t;
  }

  let userText = t;
  if (!userText) {
    userText =
      'Проанализируй вложения и ответь как наставник: помоги учиться, объясняй ход мыслей, не выполняй задания целиком за пользователя.';
  }

  const parts = [{ type: 'text', text: userText }];
  const dir = userUploadDir(userId);
  for (const f of files) {
    assertSafeStoredName(f.stored);
    const abs = path.join(dir, f.stored);
    if (!fs.existsSync(abs)) {
      parts.push({
        type: 'text',
        text: `[Файл недоступен на сервере: ${f.name || f.stored}]`
      });
      continue;
    }
    parts.push(
      await buildContentPartFromFile(abs, f.mime || 'application/octet-stream', f.name, {
        model: modelId
      })
    );
  }

  return parts;
}

/**
 * Footprint for rough quota checks (avoid counting full base64 as literal chars).
 */
function estimatePayloadFootprintForLimits(content) {
  if (typeof content === 'string') return (content || '').length;
  if (!Array.isArray(content)) {
    try {
      return JSON.stringify(content).length;
    } catch {
      return 0;
    }
  }
  let n = 0;
  for (const p of content) {
    if (!p || !p.type) {
      n += 500;
      continue;
    }
    if (p.type === 'text') {
      n += (p.text || '').length;
    } else if (p.type === 'image_url') {
      const u = p.image_url?.url || '';
      n += Math.min(u.length, 180000);
    } else if (p.type === 'file') {
      const d = p.file?.file_data || '';
      n += Math.min(d.length, 350000);
    } else if (p.type === 'input_audio') {
      const d = p.input_audio?.data || '';
      n += Math.min(d.length, 250000);
    } else if (p.type === 'video_url') {
      const u = p.video_url?.url || '';
      n += Math.min(u.length, 500000);
    } else {
      n += 2000;
    }
  }
  return n;
}

function estimateContentChars(content) {
  return estimatePayloadFootprintForLimits(content);
}

module.exports = {
  uploadsRoot,
  userUploadDir,
  persistMulterFiles,
  buildUserContentForApi,
  estimateContentChars,
  estimatePayloadFootprintForLimits,
  MAX_FILES,
  MAX_FILE_BYTES,
  ALLOWED_MIME
};
