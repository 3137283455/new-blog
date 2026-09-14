export async function writingRequest(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('boke_admin_token');
  if (!token) { location.assign('/admin'); throw new Error('请先登录'); }
  const response = await fetch('/api' + url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...options.headers } });
  if (response.status === 401) { location.assign('/admin'); throw new Error('登录已过期'); }
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.message || '请求失败，请重试');
  return json;
}
