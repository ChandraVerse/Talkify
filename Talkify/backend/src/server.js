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
const Notification = require('./models/Notification')
const User = require('./models/User')

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

  function broadcastReactionUpdate(message) {
    const payload = JSON.stringify({
      type: 'reaction_update',
      payload: {
        messageId: message._id,
        reactions: message.reactions,
        channelId: message.channelId
      }
    })

    wss.clients.forEach(client => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.channels &&
        client.channels.has(message.channelId.toString())
      ) {
        client.send(payload)
      }
    })
  }

  function sendNotificationToUser(notification) {
    const payload = JSON.stringify({
      type: 'notification_new',
      payload: notification
    })

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.userId) {
        if (client.userId.toString() === notification.userId.toString()) {
          client.send(payload)
        }
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

          if (channel.type === 'dm') {
            const targetIds = channel.members
              .map(memberId => memberId.toString())
              .filter(id => id !== userId.toString())

            for (const targetId of targetIds) {
              const notification = await Notification.create({
                userId: targetId,
                type: 'dm',
                messageId: created._id,
                channelId: channel._id
              })
              sendNotificationToUser(notification)
            }
          }

          if (threadRootId) {
            const root = await Message.findById(threadRootId)
            if (root && root.senderId.toString() !== userId.toString()) {
              const notification = await Notification.create({
                userId: root.senderId,
                type: 'reply',
                messageId: created._id,
                channelId: channel._id
              })
              sendNotificationToUser(notification)
            }
          }

          if (content) {
            const matches = content.match(/@([^\s@]+)/g) || []
            if (matches.length > 0) {
              const names = Array.from(
                new Set(
                  matches.map(m => m.slice(1)).filter(name => name && name.length > 0)
                )
              )

              if (names.length > 0) {
                const mentionedUsers = await User.find({
                  displayName: { $in: names }
                })

                for (const mentioned of mentionedUsers) {
                  if (mentioned._id.toString() === userId.toString()) {
                    continue
                  }

                  const isMember =
                    channel.type === 'public' ||
                    channel.members.some(
                      memberId => memberId.toString() === mentioned._id.toString()
                    )

                  if (!isMember) {
                    continue
                  }

                  const notification = await Notification.create({
                    userId: mentioned._id,
                    type: 'mention',
                    messageId: created._id,
                    channelId: channel._id
                  })
                  sendNotificationToUser(notification)
                }
              }
            }
          }

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

        if (message.type === 'add_reaction') {
          const { messageId, emoji } = message.payload

          const target = await Message.findById(messageId)

          if (!target) {
            return
          }

          const channel = await Channel.findById(target.channelId)

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

          const exists = target.reactions.some(
            r => r.emoji === emoji && r.userId.toString() === userId
          )

          if (!exists) {
            target.reactions.push({ emoji, userId })
            await target.save()
          }

          broadcastReactionUpdate(target)
          return
        }

        if (message.type === 'remove_reaction') {
          const { messageId, emoji } = message.payload

          const target = await Message.findById(messageId)

          if (!target) {
            return
          }

          const channel = await Channel.findById(target.channelId)

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

          target.reactions = target.reactions.filter(
            r => !(r.emoji === emoji && r.userId.toString() === userId)
          )

          await target.save()

          broadcastReactionUpdate(target)
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
