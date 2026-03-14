const express = require('express')
const Channel = require('../models/Channel')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.use(authMiddleware)

router.post('/', async (req, res) => {
  try {
    const { name, type } = req.body

    if (!name) {
      return res.status(400).json({ message: 'Name is required' })
    }

    const channel = await Channel.create({
      name,
      type: type || 'public',
      members: [req.user.id],
      createdBy: req.user.id
    })

    return res.status(201).json(channel)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

router.get('/', async (req, res) => {
  try {
    const channels = await Channel.find({
      $or: [{ type: 'public' }, { members: req.user.id }]
    }).sort({ name: 1 })

    return res.json(channels)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/:id/join', async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' })
    }

    if (channel.type === 'private') {
      return res.status(403).json({ message: 'Cannot join private channel' })
    }

    if (!channel.members.includes(req.user.id)) {
      channel.members.push(req.user.id)
      await channel.save()
    }

    return res.json(channel)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router

