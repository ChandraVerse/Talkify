import { request } from './client.js'

async function fetchNotifications(token) {
  return request('/notifications', { method: 'GET' }, token)
}

async function markNotificationRead(id, token) {
  return request(`/notifications/${id}/read`, { method: 'POST' }, token)
}

async function markAllNotificationsRead(token) {
  return request('/notifications/read-all', { method: 'POST' }, token)
}

export { fetchNotifications, markNotificationRead, markAllNotificationsRead }

