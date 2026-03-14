require('dotenv').config()

const http = require('http')
const WebSocket = require('ws')
const jwt = require('jsonwebtoken')
const app = require('./app')
const { connectMongo } = require('./config/db')
const { initRedis } = require('./config/redis')
const { getRedisClient } = require('./config/redis')
const Message = require('./models/Message')
const Channel = require('./models/Channel')

const PORT = process.env.PORT || 4000

async function start() {
  await connectMongo()
  await initRedis()

  const server = http.createServer(app)
  const wss = new WebSocket.Server({ server })

  const redis = getRedisClient()

  function broadcastPresenceUpdate(userId, status) {
    const payload = JSON.stringify({
      type: 'presence_update',
      payload: { userId, status }
    })

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    })
  }

  function broadcastTyping(channelId, userId, isTyping) {
    const payload = JSON.stringify({
      type: 'typing_update',
      payload: { channelId, userId, isTyping }
    })

    wss.clients.forEach(client => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.channels &&
        client.channels.has(channelId)
      ) {
        client.send(payload)
      }
    })
  }

  wss.on('connection', (socket, req) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const token = url.searchParams.get('token')

      if (!token) {
        socket.close()
        return
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET)
      socket.userId = payload.sub
    } catch (err) {
      socket.close()
      return
    }

    socket.channels = new Set()

    redis.sAdd('online_users', socket.userId)
    broadcastPresenceUpdate(socket.userId, 'online')

    socket.on('close', () => {
      redis.sRem('online_users', socket.userId)
      broadcastPresenceUpdate(socket.userId, 'offline')
    })

    socket.on('message', async data => {
      try {
        const message = JSON.parse(data.toString())

        if (message.type === 'join_channel') {
          const { channelId } = message.payload
          socket.channels.add(channelId)
          return
        }

        if (message.type === 'send_message') {
          const { channelId, content, threadRootId } = message.payload

          const channel = await Channel.findById(channelId)
          if (!channel) {
            return
          }

          const userId = socket.userId

          const canAccess =
            channel.type === 'public' ||
            channel.members.some(memberId => memberId.toString() === userId)

          if (!canAccess) {
            return
          }

          const created = await Message.create({
            channelId,
            senderId: userId,
            content: content || '',
            threadRootId: threadRootId || null
          })

          const payload = JSON.stringify({
            type: 'new_message',
            payload: created
          })

          redis.publish(`channel:${channelId}:messages`, payload)

          wss.clients.forEach(client => {
            if (
              client.readyState === WebSocket.OPEN &&
              client.channels &&
              client.channels.has(channelId)
            ) {
              client.send(payload)
            }
          })

          return
        }

        if (message.type === 'typing_start') {
          const { channelId } = message.payload
          broadcastTyping(channelId, socket.userId, true)
          return
        }

        if (message.type === 'typing_stop') {
          const { channelId } = message.payload
          broadcastTyping(channelId, socket.userId, false)
          return
        }
      } catch (err) {
        console.error('WebSocket message error', err)
      }
    })
  })

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })
}

start().catch(err => {
  console.error('Failed to start server', err)
  process.exit(1)
})

