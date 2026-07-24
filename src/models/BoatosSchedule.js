const mongoose = require('mongoose');

const boatosScheduleSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    sourceChannelIds: { type: [String], default: [] },
    destinationChannelId: { type: String, default: null },
    dateMode: { type: String, default: 'range', enum: ['range', 'today'] },
    dateFrom: { type: String, default: null },
    dateTo: { type: String, default: null },
    prompt: { type: String, default: '' },
    hour: { type: Number, default: 0, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    lastRunKey: { type: String, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.models.BoatosSchedule || mongoose.model('BoatosSchedule', boatosScheduleSchema);
