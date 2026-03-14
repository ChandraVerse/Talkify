# Talkify 💬

Advanced real‑time chat application inspired by Slack and Discord. Built as a full‑stack project with a scalable backend, modern React frontend, and production‑style features.

---

## Tech Stack ⚙️

- **Frontend**
  - React 18
  - Vite dev server
  - Native WebSocket client

- **Backend**
  - Node.js + Express
  - WebSockets (`ws`)
  - MongoDB (Mongoose)
  - Redis (presence, pub/sub)
  - Multer (file uploads)

- **Infrastructure**
  - Designed for MongoDB Atlas
  - Redis for pub/sub + presence

---

## Features 🚀

### Core

- 🔐 **Authentication**
  - JWT‑based auth
  - bcrypt password hashing
  - Authenticated REST API and WebSocket connection

- 💬 **Channels & Group Chat**
  - Public and private channels
  - Join/leave channels
  - Channel message history with pagination

- 📩 **Direct Messages (DMs)**
  - DM channels between users
  - DM notifications (real‑time + stored)

- 🧵 **Threaded Conversations**
  - Reply to a message and open a side‑panel thread
  - Real‑time thread updates

- 😀 **Reactions**
  - Emoji reactions on messages
  - Real‑time reaction updates

- 📎 **File Sharing**
  - Upload images, videos, and files
  - Inline previews for images and videos
  - Clickable links for other attachments

- 🔔 **Notifications**
  - DM notifications
  - Reply notifications (thread replies to your messages)
  - Mention notifications when someone types `@DisplayName`
  - Notification panel in the UI with unread count and read‑all semantics

- 👀 **Read Receipts**
  - Messages track which users have read them
  - UI shows “Seen by N” under messages

- ✏️ **Message Editing & Deletion**
  - Edit your own messages (real‑time update to all clients)
  - Delete your own messages (real‑time removal)

- 🟢 **Presence & Typing**
  - Online/offline tracking via Redis
  - Typing indicators per‑channel

- 🔎 **Search**
  - Full‑text search on message content
  - Filter by channel, user, date range

---

## Project Structure 📂

```text
Talkify/
  backend/
    src/
      config/
        db.js           # MongoDB connection
        redis.js        # Redis client
      middleware/
        auth.js         # JWT auth middleware
      models/
        User.js
        Channel.js
        Message.js
        Notification.js
      routes/
        auth.js         # /api/auth
        channels.js     # /api/channels
        messages.js     # /api/messages
        notifications.js# /api/notifications
        search.js       # /api/search
        uploads.js      # /api/uploads
        users.js        # /api/users
      app.js            # Express app & routing
      server.js         # HTTP + WebSocket server
    .env.example
    package.json

  frontend/
    src/
      api/             # REST API helpers
        auth.js
        channels.js
        client.js
        messages.js
        notifications.js
        uploads.js
        users.js
      ws/
        socket.js      # WebSocket client abstraction
      App.jsx          # Main UI (layout, chat, threads, DMs)
      main.jsx         # React entry
    index.html
    vite.config.js
    package.json
```

---

## Backend Overview 🛠️

### Auth

- `POST /api/auth/register`
  - Body: `{ email, password, displayName }`
  - Creates user, returns `{ token, user }`

- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Returns `{ token, user }`

JWT is used for:
- REST APIs via `Authorization: Bearer <token>`
- WebSocket via `ws://...:4000?token=<JWT>`

### Channels & DMs

- `POST /api/channels` – create public/private channel
- `GET /api/channels` – list channels current user can see
- `POST /api/channels/:id/join` – join public channel
- `POST /api/channels/dm` – get or create DM channel between two users

### Users

- `GET /api/users` – list other users (for DM sidebar)

### Messages

- `GET /api/messages/channel/:channelId`
  - Query: `before`, `limit`
  - Returns message history

- `POST /api/messages/channel/:channelId`
  - Body: `{ content, threadRootId? }`
  - Creates a new message (top‑level or thread reply)

- `GET /api/messages/thread/:messageId`
  - Returns full thread: root + replies

- `POST /api/messages/:id/reactions`
  - Body: `{ emoji, action: "add" | "remove" }`

- `POST /api/messages/:id/read`
  - Marks a message as read by the current user (stored in `readBy`)

### Notifications

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

Notifications are also pushed via WebSocket as `notification_new` events for:
- DM messages
- Thread replies
- Mentions (`@DisplayName`)

### Search

- `GET /api/search/messages`
  - Query: `q`, `channelId`, `userId`, `from`, `to`, `limit`
  - Uses MongoDB text index on `Message.content`

### Uploads

- `POST /api/uploads`
  - Multipart form‑data (`file` field)
  - Returns `{ url, type, name, size }`
- Static files served from `GET /uploads/...`

---

## WebSocket Protocol 🌐

Client → Server events:

- `join_channel`
  - `{ type: "join_channel", payload: { channelId } }`

- `send_message`
  - `{ type: "send_message", payload: { channelId, content, threadRootId?, attachments? } }`

- `typing_start` / `typing_stop`
  - `{ type: "typing_start", payload: { channelId } }`

- `add_reaction` / `remove_reaction`
  - `{ type: "add_reaction", payload: { messageId, emoji } }`

- `edit_message`
  - `{ type: "edit_message", payload: { messageId, content } }`

- `delete_message`
  - `{ type: "delete_message", payload: { messageId } }`

Server → Client events:

- `new_message` – new message in joined channels
- `presence_update` – `{ userId, status }`
- `typing_update` – `{ channelId, userId, isTyping }`
- `reaction_update` – `{ messageId, reactions, channelId }`
- `message_updated` – updated message content
- `message_deleted` – `{ messageId, channelId }`
- `notification_new` – new notification document

---

## Frontend Overview 🎨

Single‑page React app under `frontend/`:

- Auth screens:
  - Login/Register with JWT persisted in `localStorage`
- Main layout:
  - **Sidebar** – user info, channels, DM list, new channel form
  - **Chat pane** – header, search bar, notifications, message list, input
  - **Thread pane** – opens on “Reply” to show threaded conversation
- WebSocket client:
  - Established after login with token
  - Dispatches events for messages, typing, reactions, notifications

Key UX features:

- Real‑time channels and DMs
- Threaded replies in side panel
- Emoji reactions
- File uploads & previews
- Search with result panel
- Notifications panel (with unread count)
- Read receipt count per message
- Message edit/delete for your own messages

---

## Getting Started 🧪

### Prerequisites

- Node.js (LTS)
- MongoDB Atlas cluster (or local MongoDB for development)
- Redis instance (local or cloud)

### Backend Setup

```bash
cd Talkify/backend
npm install
cp .env.example .env
```

Edit `.env`:

```env
PORT=4000
MONGODB_URI=your-mongodb-atlas-uri
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-strong-secret
```

Run the backend:

```bash
npm start
```

The backend runs on `http://localhost:4000`.

### Frontend Setup

```bash
cd Talkify/frontend
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

---

## Development Notes 🧱

- The project is intentionally split into `backend` and `frontend` for clarity.
- The WebSocket protocol is minimal and easy to extend for:
  - Roles/permissions
  - Dark/light theme toggling
  - Advanced read‑receipt UI (showing names)
  - WebRTC voice/video calls
- MongoDB schemas are designed for migration to MongoDB Atlas with indexes on:
  - `Message.channelId`, `Message.senderId`, `Message.threadRootId`
  - text index on `Message.content`

---

## Ideas for Further Enhancements 💡

- Per‑channel roles (owner/moderator/member) and permissions
- Dark/light mode toggle persisted per user
- Message pinning and channel bookmarking
- Virtualized message list for very long histories
- WebRTC voice/video calls in DMs or channels

Talkify is already a feature‑rich, production‑style chat application and a strong foundation for experimenting with real‑time systems, microservices, or additional integrations. Enjoy hacking on it! 🎉

