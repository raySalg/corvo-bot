const mongoose = require('mongoose');

const exportScheduleSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    sourceChannelIds: { type: [String], default: [] },
    destinationChannelId: { type: String, default: null },
    /** 'range' = de/até fixos | 'today' = só o dia corrente (America/Sao_Paulo) */
    dateMode: { type: String, default: 'range', enum: ['range', 'today'] },
    dateFrom: { type: String, default: null },
    dateTo: { type: String, default: null },
    hour: { type: Number, default: 0, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    lastRunKey: { type: String, default: null },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: null },

    aiEnabled: { type: Boolean, default: false },
    aiPrompt: { type: String, default: '' },
    aiDestinationChannelId: { type: String, default: null },
    aiHour: { type: Number, default: 0, min: 0, max: 23 },
    aiMinute: { type: Number, default: 0, min: 0, max: 59 },
    aiDaysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    aiLastRunKey: { type: String, default: null },
    aiLastRunAt: { type: Date, default: null },
    aiLastError: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.models.ExportSchedule || mongoose.model('ExportSchedule', exportScheduleSchema);
