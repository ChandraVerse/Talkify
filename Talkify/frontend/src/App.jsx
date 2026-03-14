import React, { useState, useEffect, useMemo } from 'react'
import { registerUser, loginUser } from './api/auth.js'
import { fetchChannels, createChannel, joinChannel, getOrCreateDmChannel } from './api/channels.js'
import { fetchChannelMessages, fetchThread, searchMessages } from './api/messages.js'
import { fetchUsers } from './api/users.js'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from './api/notifications.js'
import { createSocket } from './ws/socket.js'

function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await loginUser(email, password)
        onAuthenticated(data)
      } else {
        const data = await registerUser(email, password, displayName)
        onAuthenticated(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.authContainer}>
      <h1>Talkify</h1>
      <div style={styles.authToggle}>
        <button
          style={mode === 'login' ? styles.authToggleActive : styles.authToggleInactive}
          onClick={() => setMode('login')}
        >
          Login
        </button>
        <button
          style={mode === 'register' ? styles.authToggleActive : styles.authToggleInactive}
          onClick={() => setMode('register')}
        >
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit} style={styles.authForm}>
        {mode === 'register' && (
          <input
            style={styles.input}
            placeholder="Display name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
        )}
        <input
          style={styles.input}
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>
    </div>
  )
}

function ChatApp({ token, user, onLogout }) {
  const [channels, setChannels] = useState([])
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [ws, setWs] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState({})
  const [typing, setTyping] = useState({})
  const [channelNameInput, setChannelNameInput] = useState('')
  const [channelType, setChannelType] = useState('public')
  const [threadRootId, setThreadRootId] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [threadInputValue, setThreadInputValue] = useState('')
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [users, setUsers] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)

  const activeChannel = useMemo(
    () => channels.find(c => c._id === activeChannelId) || null,
    [channels, activeChannelId]
  )

  useEffect(() => {
    let isMounted = true

    async function loadInitial() {
      try {
        const [channelsData, usersData, notificationsData] = await Promise.all([
          fetchChannels(token),
          fetchUsers(token),
          fetchNotifications(token)
        ])
        if (!isMounted) return
        setChannels(channelsData)
        setUsers(usersData)
        setNotifications(notificationsData)
        if (channelsData.length && !activeChannelId) {
          setActiveChannelId(channelsData[0]._id)
        }
      } catch (err) {
        console.error(err)
      }
    }

    loadInitial()

    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    if (!activeChannelId) return
    let isMounted = true

    async function loadMessages() {
      try {
        const data = await fetchChannelMessages(activeChannelId, token)
        if (!isMounted) return
        setMessages(data)
      } catch (err) {
        console.error(err)
      }
    }

    loadMessages()

    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'join_channel',
        payload: { channelId: activeChannelId }
      }
      ws.send(JSON.stringify(payload))
    }

    return () => {
      isMounted = false
    }
  }, [activeChannelId, token, ws])

  useEffect(() => {
    const socket = createSocket(token, {
      onOpen() {},
      onClose() {},
      onError() {},
      onMessage(data) {
        if (data.type === 'new_message') {
          const message = data.payload
          setMessages(prev =>
            message.channelId === activeChannelId ? [...prev, message] : prev
          )

          if (threadRootId) {
            const rootId = threadRootId
            if (
              message._id === rootId ||
              (message.threadRootId && message.threadRootId === rootId)
            ) {
              setThreadMessages(prev => [...prev, message])
            }
          }
        }

        if (data.type === 'presence_update') {
          const { userId, status } = data.payload
          setOnlineUsers(prev => ({
            ...prev,
            [userId]: status
          }))
        }

        if (data.type === 'typing_update') {
          const { channelId, userId, isTyping } = data.payload
          if (channelId !== activeChannelId) return
          setTyping(prev => {
            const updated = { ...prev }
            if (isTyping) {
              updated[userId] = true
            } else {
              delete updated[userId]
            }
            return updated
          })
        }

        if (data.type === 'reaction_update') {
          const { messageId, reactions } = data.payload
          setMessages(prev =>
            prev.map(m =>
              m._id === messageId
                ? {
                    ...m,
                    reactions
                  }
                : m
            )
          )

          if (threadRootId) {
            setThreadMessages(prev =>
              prev.map(m =>
                m._id === messageId
                  ? {
                      ...m,
                      reactions
                    }
                  : m
              )
            )
          }
        }

        if (data.type === 'notification_new') {
          const notification = data.payload
          setNotifications(prev => {
            const exists = prev.some(n => n._id === notification._id)
            if (exists) return prev
            return [notification, ...prev]
          })
        }
      }
    })

    setWs(socket)

    return () => {
      socket.close()
    }
  }, [token, activeChannelId])

  function handleSend() {
    if (!inputValue.trim() || !ws || ws.readyState !== WebSocket.OPEN || !activeChannelId) {
      return
    }

    const payload = {
      type: 'send_message',
      payload: {
        channelId: activeChannelId,
        content: inputValue
      }
    }

    ws.send(JSON.stringify(payload))
    setInputValue('')
    sendTyping(false)
  }

  function sendTyping(isTyping) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeChannelId) {
      return
    }

    const payload = {
      type: isTyping ? 'typing_start' : 'typing_stop',
      payload: {
        channelId: activeChannelId
      }
    }

    ws.send(JSON.stringify(payload))
  }

  async function handleCreateChannel(e) {
    e.preventDefault()
    if (!channelNameInput.trim()) return
    try {
      const channel = await createChannel(channelNameInput.trim(), channelType, token)
      setChannels(prev => [...prev, channel])
      setChannelNameInput('')
      setActiveChannelId(channel._id)
    } catch (err) {
      console.error(err)
    }
  }

  const typingUserIds = Object.keys(typing).filter(id => id !== user.id)
  const unreadNotifications = notifications.filter(n => !n.isRead).length

  async function openDm(targetUser) {
    try {
      const channel = await getOrCreateDmChannel(targetUser.id, token)
      setChannels(prev => {
        const exists = prev.some(c => c._id === channel._id)
        if (exists) return prev
        return [...prev, channel]
      })
      setActiveChannelId(channel._id)
    } catch (err) {
      console.error(err)
    }
  }

  async function openNotifications() {
    try {
      setShowNotifications(prev => !prev)
      if (!showNotifications && unreadNotifications > 0) {
        await markAllNotificationsRead(token)
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function goToNotification(notification) {
    try {
      if (!notification.isRead) {
        const updated = await markNotificationRead(notification._id, token)
        setNotifications(prev =>
          prev.map(n => (n._id === updated._id ? { ...n, isRead: updated.isRead } : n))
        )
      }
    } catch (err) {
      console.error(err)
    }

    if (notification.channelId) {
      setActiveChannelId(notification.channelId)
    }

    setShowNotifications(false)
  }

  async function openThread(message) {
    try {
      const rootId = message.threadRootId || message._id
      const data = await fetchThread(rootId, token)
      setThreadRootId(rootId)
      setThreadMessages(data)
      setThreadInputValue('')
    } catch (err) {
      console.error(err)
    }
  }

  function closeThread() {
    setThreadRootId(null)
    setThreadMessages([])
    setThreadInputValue('')
  }

  function toggleReaction(message, emoji) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }

    const hasReaction =
      message.reactions &&
      message.reactions.some(r => r.emoji === emoji && r.userId === user.id)

    const type = hasReaction ? 'remove_reaction' : 'add_reaction'

    const payload = {
      type,
      payload: {
        messageId: message._id,
        emoji
      }
    }

    ws.send(JSON.stringify(payload))
  }

  function handleSendThread() {
    if (
      !threadInputValue.trim() ||
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !activeChannelId ||
      !threadRootId
    ) {
      return
    }

    const payload = {
      type: 'send_message',
      payload: {
        channelId: activeChannelId,
        content: threadInputValue,
        threadRootId
      }
    }

    ws.send(JSON.stringify(payload))
    setThreadInputValue('')
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchText.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearching(true)
      const results = await searchMessages({ q: searchText, limit: 50 }, token)
      setSearchResults(results)
    } catch (err) {
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  function goToMessage(result) {
    if (!result.channelId) return
    setActiveChannelId(result.channelId)
    setSearchResults([])
  }

  return (
    <div style={styles.appShell}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div>{user.displayName}</div>
          <button style={styles.secondaryButton} onClick={onLogout}>
            Logout
          </button>
        </div>
        <div style={styles.sectionTitle}>Channels</div>
        <div style={styles.channelList}>
          {channels.map(channel => (
            <button
              key={channel._id}
              style={
                channel._id === activeChannelId
                  ? styles.channelButtonActive
                  : styles.channelButton
              }
              onClick={() => setActiveChannelId(channel._id)}
            >
              <span># {channel.name}</span>
            </button>
          ))}
        </div>
        <div style={styles.sectionTitle}>Direct Messages</div>
        <div style={styles.dmList}>
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              style={styles.dmButton}
              onClick={() => openDm(u)}
            >
              <span>{u.displayName}</span>
            </button>
          ))}
        </div>
        <form onSubmit={handleCreateChannel} style={styles.channelForm}>
          <input
            style={styles.input}
            placeholder="New channel name"
            value={channelNameInput}
            onChange={e => setChannelNameInput(e.target.value)}
          />
          <select
            style={styles.select}
            value={channelType}
            onChange={e => setChannelType(e.target.value)}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button style={styles.primaryButton} type="submit">
            Create
          </button>
        </form>
      </div>
      <div style={styles.chatPane}>
        <div style={styles.chatHeader}>
          <div>
            {activeChannel ? `# ${activeChannel.name}` : 'Select a channel'}
          </div>
          <form style={styles.searchForm} onSubmit={handleSearch}>
            <input
              style={styles.searchInput}
              placeholder="Search messages"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <button style={styles.secondaryButton} type="submit" disabled={searching}>
              Search
            </button>
          </form>
          <button
            style={styles.secondaryButton}
            type="button"
            onClick={openNotifications}
          >
            Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
          </button>
          <div style={styles.presence}>
            Online: {Object.values(onlineUsers).filter(s => s === 'online').length}
          </div>
        </div>
        {showNotifications && (
          <div style={styles.notificationsPanel}>
            <div style={styles.notificationsHeader}>
              <span>Notifications</span>
              <button
                style={styles.secondaryButton}
                type="button"
                onClick={() => setShowNotifications(false)}
              >
                Close
              </button>
            </div>
            <div style={styles.notificationsList}>
              {notifications.length === 0 && (
                <div style={styles.notificationEmpty}>No notifications</div>
              )}
              {notifications.map(notification => (
                <button
                  key={notification._id}
                  type="button"
                  style={
                    notification.isRead
                      ? styles.notificationItem
                      : styles.notificationItemUnread
                  }
                  onClick={() => goToNotification(notification)}
                >
                  <div style={styles.notificationMeta}>
                    <span>{notification.type}</span>
                    <span style={styles.messageTime}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {searchResults.length > 0 && (
          <div style={styles.searchResults}>
            <div style={styles.searchResultsHeader}>
              <span>Search results</span>
              <button
                style={styles.secondaryButton}
                type="button"
                onClick={() => setSearchResults([])}
              >
                Close
              </button>
            </div>
            <div style={styles.searchResultsList}>
              {searchResults.map(result => (
                <button
                  key={result._id}
                  style={styles.searchResultItem}
                  type="button"
                  onClick={() => goToMessage(result)}
                >
                  <div style={styles.searchResultMeta}>
                    <span>{result.senderId}</span>
                    <span style={styles.messageTime}>
                      {new Date(result.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>{result.content}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={styles.chatBody}>
          <div style={styles.messages}>
            {messages.map(m => {
              const emojis = ['👍', '❤️', '😀']
              const userReactions = m.reactions || []

              return (
                <div key={m._id} style={styles.messageRow}>
                  <div style={styles.messageMeta}>
                    <span>{m.senderId}</span>
                    <span style={styles.messageTime}>
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>{m.content}</div>
                  <div style={styles.messageActions}>
                    <div style={styles.reactionBar}>
                      {emojis.map(emoji => {
                        const reacted = userReactions.some(
                          r => r.emoji === emoji && r.userId === user.id
                        )
                        return (
                          <button
                            key={emoji}
                            type="button"
                            style={reacted ? styles.reactionButtonActive : styles.reactionButton}
                            onClick={() => toggleReaction(m, emoji)}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      style={styles.replyButton}
                      onClick={() => openThread(m)}
                    >
                      Reply
                    </button>
                  </div>
                  {userReactions.length > 0 && (
                    <div style={styles.reactions}>
                      {userReactions.map((r, index) => (
                        <span key={index} style={styles.reaction}>
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={styles.inputArea}>
            {typingUserIds.length > 0 && (
              <div style={styles.typingIndicator}>Someone is typing...</div>
            )}
            <div style={styles.inputRow}>
              <input
                style={styles.messageInput}
                placeholder="Message"
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value)
                  sendTyping(true)
                }}
                onBlur={() => sendTyping(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button style={styles.primaryButton} onClick={handleSend}>
                Send
              </button>
            </div>
          </div>
        </div>
        {threadRootId && (
          <div style={styles.threadPane}>
            <div style={styles.threadHeader}>
              <span>Thread</span>
              <button style={styles.secondaryButton} type="button" onClick={closeThread}>
                Close
              </button>
            </div>
            <div style={styles.threadMessages}>
              {threadMessages.map(m => (
                <div key={m._id} style={styles.messageRow}>
                  <div style={styles.messageMeta}>
                    <span>{m.senderId}</span>
                    <span style={styles.messageTime}>
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>{m.content}</div>
                  {m.reactions && m.reactions.length > 0 && (
                    <div style={styles.reactions}>
                      {m.reactions.map((r, index) => (
                        <span key={index} style={styles.reaction}>
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={styles.inputArea}>
              <div style={styles.inputRow}>
                <input
                  style={styles.messageInput}
                  placeholder="Reply in thread"
                  value={threadInputValue}
                  onChange={e => setThreadInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendThread()
                    }
                  }}
                />
                <button style={styles.primaryButton} onClick={handleSendThread}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem('talkify_auth')
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })

  function handleAuthenticated(data) {
    const payload = {
      token: data.token,
      user: data.user
    }
    setAuth(payload)
    localStorage.setItem('talkify_auth', JSON.stringify(payload))
  }

  function handleLogout() {
    setAuth(null)
    localStorage.removeItem('talkify_auth')
  }

  if (!auth) {
    return <AuthForm onAuthenticated={handleAuthenticated} />
  }

  return <ChatApp token={auth.token} user={auth.user} onLogout={handleLogout} />
}

const styles = {
  authContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    color: '#f9fafb'
  },
  authToggle: {
    display: 'flex',
    marginBottom: 16
  },
  authToggleActive: {
    padding: '8px 16px',
    border: '1px solid #38bdf8',
    backgroundColor: '#38bdf8',
    color: '#0f172a',
    cursor: 'pointer'
  },
  authToggleInactive: {
    padding: '8px 16px',
    border: '1px solid #64748b',
    backgroundColor: 'transparent',
    color: '#e2e8f0',
    cursor: 'pointer'
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    width: 320,
    gap: 8
  },
  input: {
    padding: '8px 10px',
    borderRadius: 4,
    border: '1px solid #64748b',
    backgroundColor: '#020617',
    color: '#e2e8f0'
  },
  select: {
    padding: '8px 10px',
    borderRadius: 4,
    border: '1px solid #64748b',
    backgroundColor: '#020617',
    color: '#e2e8f0'
  },
  primaryButton: {
    padding: '8px 12px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#22c55e',
    color: '#022c22',
    cursor: 'pointer'
  },
  secondaryButton: {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #64748b',
    backgroundColor: 'transparent',
    color: '#e2e8f0',
    cursor: 'pointer'
  },
  error: {
    color: '#f97316',
    fontSize: 12
  },
  appShell: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#020617',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  sidebar: {
    width: 260,
    borderRight: '1px solid #1f2937',
    padding: 12,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column'
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 4
  },
  channelList: {
    flex: 1,
    overflow: 'auto',
    marginBottom: 8
  },
  dmList: {
    maxHeight: 160,
    overflow: 'auto',
    marginBottom: 8
  },
  channelButton: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#e5e7eb',
    textAlign: 'left',
    cursor: 'pointer'
  },
  channelButtonActive: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#1d4ed8',
    color: '#e5e7eb',
    textAlign: 'left',
    cursor: 'pointer'
  },
  channelForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  dmButton: {
    width: '100%',
    padding: '4px 8px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#e5e7eb',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 14
  },
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  chatHeader: {
    padding: '8px 12px',
    borderBottom: '1px solid #1f2937',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  searchForm: {
    display: 'flex',
    gap: 6,
    marginLeft: 12,
    marginRight: 12
  },
  searchInput: {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #4b5563',
    backgroundColor: '#020617',
    color: '#e5e7eb'
  },
  notificationsPanel: {
    position: 'absolute',
    top: 44,
    right: 12,
    width: 260,
    maxHeight: 280,
    borderRadius: 8,
    border: '1px solid #1f2937',
    backgroundColor: '#020617',
    boxShadow: '0 10px 15px rgba(0,0,0,0.5)',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column'
  },
  notificationsHeader: {
    padding: '6px 8px',
    borderBottom: '1px solid #1f2937',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13
  },
  notificationsList: {
    padding: '4px 4px 8px 4px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  notificationItem: {
    textAlign: 'left',
    borderRadius: 4,
    border: '1px solid #1f2937',
    backgroundColor: '#020617',
    color: '#e5e7eb',
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: 12
  },
  notificationItemUnread: {
    textAlign: 'left',
    borderRadius: 4,
    border: '1px solid #22c55e',
    backgroundColor: '#064e3b',
    color: '#bbf7d0',
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: 12
  },
  notificationMeta: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  notificationEmpty: {
    padding: '6px 8px',
    fontSize: 12,
    color: '#9ca3af'
  },
  presence: {
    fontSize: 12,
    color: '#9ca3af'
  },
  chatBody: {
    flex: 1,
    display: 'flex'
  },
  messages: {
    flex: 2,
    padding: '8px 12px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  messageRow: {
    padding: '4px 6px',
    borderRadius: 4,
    backgroundColor: '#020617'
  },
  messageMeta: {
    fontSize: 11,
    color: '#9ca3af',
    display: 'flex',
    justifyContent: 'space-between'
  },
  messageTime: {
    marginLeft: 8
  },
  reactions: {
    marginTop: 2,
    display: 'flex',
    gap: 4
  },
  reaction: {
    fontSize: 12,
    padding: '2px 4px',
    borderRadius: 999,
    backgroundColor: '#111827'
  },
  messageActions: {
    marginTop: 4,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  reactionBar: {
    display: 'flex',
    gap: 4
  },
  reactionButton: {
    padding: '2px 4px',
    borderRadius: 999,
    border: '1px solid #374151',
    backgroundColor: 'transparent',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontSize: 12
  },
  reactionButtonActive: {
    padding: '2px 4px',
    borderRadius: 999,
    border: '1px solid #22c55e',
    backgroundColor: '#064e3b',
    color: '#bbf7d0',
    cursor: 'pointer',
    fontSize: 12
  },
  replyButton: {
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid #4b5563',
    backgroundColor: 'transparent',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontSize: 12
  },
  inputArea: {
    borderTop: '1px solid #1f2937',
    padding: 8
  },
  inputRow: {
    display: 'flex',
    gap: 8
  },
  messageInput: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 4,
    border: '1px solid #4b5563',
    backgroundColor: '#020617',
    color: '#e5e7eb'
  },
  typingIndicator: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4
  },
  threadPane: {
    width: 320,
    borderLeft: '1px solid #1f2937',
    display: 'flex',
    flexDirection: 'column'
  },
  threadHeader: {
    padding: '8px 12px',
    borderBottom: '1px solid #1f2937',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  threadMessages: {
    flex: 1,
    padding: '8px 12px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  searchResults: {
    borderBottom: '1px solid #1f2937',
    padding: '8px 12px'
  },
  searchResultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  searchResultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  searchResultItem: {
    textAlign: 'left',
    borderRadius: 4,
    border: '1px solid #1f2937',
    backgroundColor: '#020617',
    color: '#e5e7eb',
    padding: '4px 6px',
    cursor: 'pointer'
  },
  searchResultMeta: {
    fontSize: 11,
    color: '#9ca3af',
    display: 'flex',
    justifyContent: 'space-between'
  }
}

export default App
