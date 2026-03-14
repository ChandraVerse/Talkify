const express = require('express')
const Message = require('../models/Message')
const Channel = require('../models/Channel')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.use(authMiddleware)

router.get('/messages', async (req, res) => {
  try {
    const { q, channelId, userId, from, to, limit = 50 } = req.query

    let channels

    if (channelId) {
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

      channels = [channel]
    } else {
      channels = await Channel.find({
        $or: [{ type: 'public' }, { members: req.user.id }]
      }).select('_id')
    }

    const channelIds = channels.map(c => c._id)

    const query = {
      channelId: { $in: channelIds },
      deletedAt: null
    }

    if (q) {
      query.$text = { $search: q }
    }

    if (userId) {
      query.senderId = userId
    }

    if (from || to) {
      query.createdAt = {}
      if (from) {
        query.createdAt.$gte = new Date(from)
      }
      if (to) {
        query.createdAt.$lte = new Date(to)
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()

    return res.json(messages)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router

