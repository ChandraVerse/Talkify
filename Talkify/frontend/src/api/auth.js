import { request } from './client.js'

async function registerUser(email, password, displayName) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName })
  })
}

async function loginUser(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

export { registerUser, loginUser }

