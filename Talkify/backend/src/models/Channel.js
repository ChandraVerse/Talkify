const { Schema, model } = require('mongoose')

const channelSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['public', 'private', 'dm'],
      default: 'public'
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
)

const Channel = model('Channel', channelSchema)

module.exports = Channel

