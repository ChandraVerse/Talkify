import { request } from './client.js'

async function fetchChannels(token) {
  return request('/channels', { method: 'GET' }, token)
}

async function createChannel(name, type, token) {
  return request(
    '/channels',
    {
      method: 'POST',
      body: JSON.stringify({ name, type })
    },
    token
  )
}

async function joinChannel(id, token) {
  return request(`/channels/${id}/join`, { method: 'POST' }, token)
}

async function getOrCreateDmChannel(targetUserId, token) {
  return request(
    '/channels/dm',
    {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    },
    token
  )
}

export { fetchChannels, createChannel, joinChannel, getOrCreateDmChannel }
