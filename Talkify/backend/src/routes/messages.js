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
      channel.type === 'public' ||
      channel.members.some(memberId => memberId.toString() === req.user.id)

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
      channel.type === 'public' ||
      channel.members.some(memberId => memberId.toString() === req.user.id)

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

router.get('/thread/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params

    const root = await Message.findById(messageId)

    if (!root) {
      return res.status(404).json({ message: 'Message not found' })
    }

    const channel = await Channel.findById(root.channelId)

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const canAccess =
      channel.type === 'public' ||
      channel.members.some(memberId => memberId.toString() === req.user.id)

    if (!canAccess) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const threadRootId = root.threadRootId || root._id

    const messages = await Message.find({
      $or: [{ _id: threadRootId }, { threadRootId }],
      deletedAt: null
    })
      .sort({ createdAt: 1 })
      .lean()

    return res.json(messages)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/:id/reactions', async (req, res) => {
  try {
    const { id } = req.params
    const { emoji, action } = req.body

    if (!emoji || !action) {
      return res.status(400).json({ message: 'Emoji and action are required' })
    }

    const message = await Message.findById(id)

    if (!message) {
      return res.status(404).json({ message: 'Message not found' })
    }

    const channel = await Channel.findById(message.channelId)

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    const canAccess =
      channel.type === 'public' ||
      channel.members.some(memberId => memberId.toString() === req.user.id)

    if (!canAccess) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    if (action === 'add') {
      const already = message.reactions.some(
        r => r.emoji === emoji && r.userId.toString() === req.user.id
      )

      if (!already) {
        message.reactions.push({ emoji, userId: req.user.id })
      }
    } else if (action === 'remove') {
      message.reactions = message.reactions.filter(
        r => !(r.emoji === emoji && r.userId.toString() === req.user.id)
      )
    } else {
      return res.status(400).json({ message: 'Invalid action' })
    }

    await message.save()

    return res.json(message)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router
