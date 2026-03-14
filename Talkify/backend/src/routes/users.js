const express = require('express')
const User = require('../models/User')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.id }
    })
      .select('_id email displayName avatarUrl status')
      .sort({ displayName: 1 })
      .lean()

    const mapped = users.map(u => ({
      id: u._id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      status: u.status
    }))

    return res.json(mapped)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

module.exports = router

