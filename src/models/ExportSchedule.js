const mongoose = require('mongoose');

const exportScheduleSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    sourceChannelIds: { type: [String], default: [] },
    destinationChannelId: { type: String, default: null },
    hour: { type: Number, default: 0, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    lastRunKey: { type: String, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.models.ExportSchedule || mongoose.model('ExportSchedule', exportScheduleSchema);
