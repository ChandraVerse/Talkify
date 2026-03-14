require('dotenv').config()

const http = require('http')
const WebSocket = require('ws')
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

  wss.on('connection', socket => {
    socket.channels = new Set()

    socket.on('message', async data => {
      try {
        const message = JSON.parse(data.toString())

        if (message.type === 'join_channel') {
          const { channelId } = message.payload
          socket.channels.add(channelId)
          return
        }

        if (message.type === 'send_message') {
          const { channelId, senderId, content, threadRootId } = message.payload

          const channel = await Channel.findById(channelId)
          if (!channel) {
            return
          }

          const created = await Message.create({
            channelId,
            senderId,
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

