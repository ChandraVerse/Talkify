const { createClient } = require('redis')

let client

async function initRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'

  client = createClient({ url })
  client.on('error', err => {
    console.error('Redis client error', err)
  })

  await client.connect()
  console.log('Connected to Redis')

  return client
}

function getRedisClient() {
  if (!client) {
    throw new Error('Redis client has not been initialized')
  }
  return client
}

module.exports = { initRedis, getRedisClient }
