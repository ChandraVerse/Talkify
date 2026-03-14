const API_BASE = '/api'

async function request(path, options = {}, token) {
  const headers = options.headers ? { ...options.headers } : {}

  if (!headers['Content-Type'] && options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message = data && data.message ? data.message : 'Request failed'
    throw new Error(message)
  }

  return data
}

export { request }
