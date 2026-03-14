import { request } from './client.js'

async function fetchChannelMessages(channelId, token) {
  return request(`/messages/channel/${channelId}`, { method: 'GET' }, token)
}

async function fetchThread(messageId, token) {
  return request(`/messages/thread/${messageId}`, { method: 'GET' }, token)
}

async function searchMessages(params, token) {
  const query = new URLSearchParams()

  if (params.q) query.set('q', params.q)
  if (params.channelId) query.set('channelId', params.channelId)
  if (params.userId) query.set('userId', params.userId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.limit) query.set('limit', String(params.limit))

  return request(`/search/messages?${query.toString()}`, { method: 'GET' }, token)
}

export { fetchChannelMessages, fetchThread, searchMessages }

