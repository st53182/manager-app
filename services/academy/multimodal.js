const fs = require('fs');
const path = require('path');

const MAX_FILE_BYTES = parseInt(process.env.ACADEMY_MAX_FILE_MB || '25', 10) * 1024 * 1024;
const MAX_FILES = parseInt(process.env.ACADEMY_MAX_FILES_PER_MESSAGE || '8', 10);

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
 * Build OpenRouter-compatible content parts from disk (after multer saved files).
 */
function filePathToContentPart(absPath, mime, originalName) {
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

  if (
    mime === 'text/plain' ||
    mime === 'text/csv' ||
    mime === 'application/json' ||
    mime === 'text/tab-separated-values'
  ) {
    const text = buf.toString('utf8');
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
    fs.writeFileSync(path.join(dir, stored), buf);
    saved.push({
      stored,
      name: f.originalname || stored,
      mime: f.mimetype
    });
  }
  return saved;
}

/**
 * Build message content for OpenRouter: string or multimodal array.
 */
async function buildUserContentForApi(text, userId, meta) {
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
    parts.push(filePathToContentPart(abs, f.mime || 'application/octet-stream', f.name));
  }

  return parts;
}

function estimateContentChars(content) {
  if (typeof content === 'string') return content.length;
  return JSON.stringify(content).length;
}

module.exports = {
  uploadsRoot,
  persistMulterFiles,
  buildUserContentForApi,
  estimateContentChars,
  MAX_FILES,
  MAX_FILE_BYTES,
  ALLOWED_MIME
};
