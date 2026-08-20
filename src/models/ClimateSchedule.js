const mongoose = require('mongoose');

const climateScheduleSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    destinationChannelId: { type: String, default: null },
    season: {
      type: String,
      default: 'autumn',
      enum: ['spring', 'summer', 'autumn', 'winter'],
    },
    promptExtra: { type: String, default: '' },
    hour: { type: Number, default: 8, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    lastClimateContent: { type: String, default: null },
    lastRunKey: { type: String, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.ClimateSchedule || mongoose.model('ClimateSchedule', climateScheduleSchema);
