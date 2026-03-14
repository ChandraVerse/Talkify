import { request } from './client.js'

async function fetchUsers(token) {
  return request('/users', { method: 'GET' }, token)
}

export { fetchUsers }

