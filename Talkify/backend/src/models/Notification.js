const { Schema, model } = require('mongoose')

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['dm', 'reply', 'mention'],
      required: true
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

const Notification = model('Notification', notificationSchema)

module.exports = Notification

