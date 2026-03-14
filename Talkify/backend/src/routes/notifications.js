const express = require('express')
const Notification = require('../models/Notification')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.id
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    return res.json(notifications)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id
      },
      { isRead: true },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    return res.json(notification)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      {
        userId: req.user.id,
        isRead: false
      },
      { isRead: true }
    )

    return res.json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router

