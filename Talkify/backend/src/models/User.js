const { Schema, model } = require('mongoose')

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true
    },
    avatarUrl: {
      type: String
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline'
    },
    lastSeenAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)

const User = model('User', userSchema)

module.exports = User
