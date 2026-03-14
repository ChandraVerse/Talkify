require('dotenv').config()

const http = require('http')
const WebSocket = require('ws')
const app = require('./app')
const { connectMongo } = require('./config/db')
const { initRedis } = require('./config/redis')

const PORT = process.env.PORT || 4000

async function start() {
  await connectMongo()
  await initRedis()

  const server = http.createServer(app)
  const wss = new WebSocket.Server({ server })

  wss.on('connection', socket => {
    socket.send(
      JSON.stringify({
        type: 'welcome',
        payload: 'Connected to Talkify backend'
      })
    )
  })

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })
}

start().catch(err => {
  console.error('Failed to start server', err)
  process.exit(1)
})

