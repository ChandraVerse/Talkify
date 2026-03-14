const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/auth')
const channelRoutes = require('./routes/channels')
const messageRoutes = require('./routes/messages')
const searchRoutes = require('./routes/search')
const notificationRoutes = require('./routes/notifications')

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true
  })
)

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/channels', channelRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

module.exports = app
