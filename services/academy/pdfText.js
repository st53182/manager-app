/**
 * Извлечение текста из PDF на сервере (дешевле по токенам, чем multimodal file на OpenRouter).
 */
async function extractPdfText(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return {
    text: (data.text || '').trim(),
    numpages: data.numpages || 0
  };
}

module.exports = { extractPdfText };
