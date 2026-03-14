import { request } from './client.js'

async function uploadAttachment(file, token) {
  const formData = new FormData()
  formData.append('file', file)
  return request('/uploads', { method: 'POST', body: formData }, token)
}

export { uploadAttachment }

