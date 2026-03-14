const express = require('express')
const cors = require('cors')
const path = require('path')
const authRoutes = require('./routes/auth')
const channelRoutes = require('./routes/channels')
const messageRoutes = require('./routes/messages')
const searchRoutes = require('./routes/search')
const notificationRoutes = require('./routes/notifications')
const userRoutes = require('./routes/users')
const uploadRoutes = require('./routes/uploads')

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true
  })
)

app.use(express.json())

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/channels', channelRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/users', userRoutes)
app.use('/api/uploads', uploadRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

module.exports = app
