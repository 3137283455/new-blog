const DEVICE_TOKEN_KEY = 'boke_private_device_token'
const DEVICE_CLIENT_KEY = 'boke_private_device_client_id'
const REGISTERED_CLIENT_KEY = 'boke_private_device_registered_client_id'

function deviceClientId() {
  let id = localStorage.getItem(DEVICE_CLIENT_KEY)
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_CLIENT_KEY, id)
  }
  return id
}

async function tokenWorks(apiBase: string, token: string) {
  try {
    const response = await fetch(`${apiBase}/private/library`, { headers: { 'X-Device-Token': token } })
    return response.ok
  } catch {
    return false
  }
}

export async function ensurePrivateDeviceToken(apiBase = '/api') {
  const existing = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
  if (existing && await tokenWorks(apiBase, existing)) return existing
  if (existing) localStorage.removeItem(DEVICE_TOKEN_KEY)

  const adminToken = localStorage.getItem('boke_admin_token') || ''
  if (!adminToken) return ''
  const clientId = deviceClientId()
  try {
    const response = await fetch(`${apiBase}/admin/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `${(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || '设备'} · ${navigator.userAgent.includes('Mobile') ? '移动端' : '浏览器'}`,
        platform: navigator.userAgent,
        client_id: clientId,
      }),
    })
    const json = await response.json().catch(() => ({}))
    const token = json.data?.token || ''
    if (!response.ok || !token) return ''
    localStorage.setItem(DEVICE_TOKEN_KEY, token)
    localStorage.setItem(REGISTERED_CLIENT_KEY, clientId)
    return token
  } catch {
    return ''
  }
}