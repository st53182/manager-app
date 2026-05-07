const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const { parse: parseCsv } = require('csv-parse/sync');
const { load } = require('cheerio');

function chunkText(text, chunkSize = 1000, overlap = 150) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    const part = clean.slice(i, i + chunkSize);
    chunks.push(part);
    if (i + chunkSize >= clean.length) break;
    i += chunkSize - overlap;
  }
  return chunks;
}

function embedTextSimple(text) {
  const out = new Array(48).fill(0);
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    out[i % out.length] += s.charCodeAt(i) % 97;
  }
  const norm = Math.sqrt(out.reduce((acc, v) => acc + v * v, 0)) || 1;
  return out.map((v) => Number((v / norm).toFixed(6)));
}

function cosine(a, b) {
  if (!a?.length || !b?.length) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    an += a[i] * a[i];
    bn += b[i] * b[i];
  }
  return dot / ((Math.sqrt(an) * Math.sqrt(bn)) || 1);
}

async function parseDocumentText(document) {
  if (document.source_type === 'url' && document.source_url) {
    return `URL source: ${document.source_url}\nThis source is attached for retrieval context.`;
  }
  const fullPath = document.storage_path;
  if (!fullPath || !fs.existsSync(fullPath)) {
    throw new Error('Uploaded source file is missing from storage.');
  }
  const ext = path.extname(document.name || '').toLowerCase();
  if (ext === '.pdf') {
    const raw = fs.readFileSync(fullPath);
    const out = await pdf(raw);
    return out.text || '';
  }
  if (ext === '.docx') {
    const raw = fs.readFileSync(fullPath);
    const out = await mammoth.extractRawText({ buffer: raw });
    return out.value || '';
  }
  if (ext === '.xlsx') {
    const wb = xlsx.readFile(fullPath);
    return wb.SheetNames.map((n) => xlsx.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
  }
  if (ext === '.csv') {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const rows = parseCsv(raw, { relax_quotes: true, skip_empty_lines: true });
    return rows.map((r) => r.join(' | ')).join('\n');
  }
  if (ext === '.html' || ext === '.htm') {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const $ = load(raw);
    return $.text();
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function buildRetrieval(query, chunks, topK = 5) {
  const queryEmb = embedTextSimple(query);
  const ranked = chunks
    .map((c) => ({
      ...c,
      score: cosine(queryEmb, Array.isArray(c.embedding) ? c.embedding : JSON.parse(c.embedding || '[]'))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return ranked;
}

function strictNoSourceMessage() {
  return 'Я не нашел это в загруженных источниках.';
}

module.exports = {
  chunkText,
  embedTextSimple,
  parseDocumentText,
  buildRetrieval,
  strictNoSourceMessage
};
