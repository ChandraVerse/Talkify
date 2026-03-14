const express = require('express')
const Message = require('../models/Message')
const Channel = require('../models/Channel')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.use(authMiddleware)

router.get('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params
    const { before, limit = 50 } = req.query

    const channel = await Channel.findById(channelId)
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const canAccess =
      channel.type === 'public' || channel.members.includes(req.user.id)

    if (!canAccess) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const query = {
      channelId,
      deletedAt: null
    }

    if (before) {
      query.createdAt = { $lt: new Date(before) }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()

    return res.json(messages.reverse())
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params
    const { content, threadRootId } = req.body

    const channel = await Channel.findById(channelId)
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const canAccess =
      channel.type === 'public' || channel.members.includes(req.user.id)

    if (!canAccess) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const message = await Message.create({
      channelId,
      senderId: req.user.id,
      content: content || '',
      threadRootId: threadRootId || null
    })

    return res.status(201).json(message)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router

