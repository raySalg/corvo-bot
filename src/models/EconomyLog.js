const mongoose = require('mongoose');

const economyLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['cycle', 'action', 'transfer', 'admin', 'tax'],
      required: true,
    },
    houseSlug: { type: String, default: null },
    targetSlug: { type: String, default: null },
    amount: { type: Number, default: 0 },
    detail: { type: String, default: '' },
    actorId: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('EconomyLog', economyLogSchema);
