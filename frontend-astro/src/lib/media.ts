const apiBase = import.meta.env.PUBLIC_API_BASE || ''
const explicitUploadBase = import.meta.env.PUBLIC_UPLOAD_BASE || ''

export const uploadBase = explicitUploadBase || apiBase.replace(/\/api\/?$/, '')

export function resolveUploadUrl(src = '') {
  if (!src) return ''
  if (!src.startsWith('/uploads/')) return src
  return uploadBase ? `${uploadBase}${src}` : src
}
