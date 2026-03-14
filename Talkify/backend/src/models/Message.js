const { Schema, model } = require('mongoose')

const reactionSchema = new Schema(
  {
    emoji: {
      type: String,
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    _id: false
  }
)

const attachmentSchema = new Schema(
  {
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video', 'file'],
      required: true
    },
    name: {
      type: String
    },
    size: {
      type: Number
    }
  },
  {
    _id: false
  }
)

const messageSchema = new Schema(
  {
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    content: {
      type: String,
      default: ''
    },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    threadRootId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
)

messageSchema.index({ content: 'text' })

const Message = model('Message', messageSchema)

module.exports = Message

