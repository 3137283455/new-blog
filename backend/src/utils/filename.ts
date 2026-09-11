const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const MOJIBAKE_PATTERN = /(?:Ã.|Â.|æ.|å.|ç.|è.|é.|ï¿½|�)/g

function scoreFilename(value: string) {
  const cjk = (value.match(CJK_PATTERN) || []).length
  const mojibake = (value.match(MOJIBAKE_PATTERN) || []).length
  const replacement = (value.match(/�/g) || []).length
  const controls = (value.match(/[\u0000-\u001f\u007f-\u009f]/g) || []).length
  return cjk * 8 - mojibake * 4 - replacement * 20 - controls * 10
}

function decodeAsUtf8(value: string) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(value, 'latin1'))
  } catch {
    return ''
  }
}

function decodeAsGb18030(value: string) {
  try {
    return new TextDecoder('gb18030', { fatal: true }).decode(Buffer.from(value, 'latin1'))
  } catch {
    return ''
  }
}

/**
 * Browsers normally submit multipart filenames as UTF-8, while older busboy
 * defaults can expose the same bytes as Latin-1. Pick the most plausible
 * candidate without changing already-correct Unicode filenames.
 */
export function normalizeUploadedFilename(raw: unknown) {
  const input = String(raw ?? '').replace(/\0/g, '').trim()
  if (!input) return '未命名文件'

  const inputScore = scoreFilename(input)
  try {
    const decoded = decodeURIComponent(input)
    if (decoded && decoded !== input && scoreFilename(decoded) > inputScore) return decoded
  } catch {
    // Keep the original filename when it is not percent-encoded.
  }

  const utf8 = decodeAsUtf8(input)
  // Prefer a valid UTF-8 repair over GB18030: modern browsers submit UTF-8,
  // and a GB18030 decode can produce plausible-looking but wrong CJK text.
  if (utf8 && scoreFilename(utf8) > inputScore) return utf8
  const gb18030 = decodeAsGb18030(input)
  if (gb18030 && scoreFilename(gb18030) > inputScore) return gb18030

  return input
}
