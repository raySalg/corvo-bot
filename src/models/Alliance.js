const mongoose = require('mongoose');

const allianceSchema = new mongoose.Schema(
  {
    houseA: { type: String, required: true },
    houseB: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending',
    },
    proposedBy: { type: String, required: true },
  },
  { timestamps: true },
);

allianceSchema.index({ houseA: 1, houseB: 1 }, { unique: true });

module.exports = mongoose.model('Alliance', allianceSchema);
