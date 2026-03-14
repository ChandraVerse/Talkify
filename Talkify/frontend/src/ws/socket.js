function createSocket(token, handlers) {
  const url = `ws://localhost:4000?token=${encodeURIComponent(token)}`
  const socket = new WebSocket(url)

  socket.onopen = () => {
    if (handlers.onOpen) handlers.onOpen(socket)
  }

  socket.onclose = event => {
    if (handlers.onClose) handlers.onClose(event)
  }

  socket.onerror = event => {
    if (handlers.onError) handlers.onError(event)
  }

  socket.onmessage = event => {
    try {
      const data = JSON.parse(event.data)
      if (handlers.onMessage) handlers.onMessage(data)
    } catch (err) {
      console.error(err)
    }
  }

  return socket
}

export { createSocket }

