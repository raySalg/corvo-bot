const mongoose = require('mongoose');

const messageScheduleSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: true },
    channelId: { type: String, default: null },
    content: { type: String, default: '' },
    mentionRoleId: { type: String, default: null },
    date: { type: String, default: null },
    hour: { type: Number, default: 0, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
    lastRunKey: { type: String, default: null },
    lastSentAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

messageScheduleSchema.index({ guildId: 1, enabled: 1, date: 1 });

module.exports =
  mongoose.models.MessageSchedule || mongoose.model('MessageSchedule', messageScheduleSchema);
