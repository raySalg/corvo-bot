const mongoose = require('mongoose');
const { WORLD_STATUS } = require('../constants/world');

const worldStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'westeros' },
    governanteWesterosSlug: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(WORLD_STATUS),
      default: WORLD_STATUS.ESTAVEL,
    },
    conflictHouseSlugs: [{ type: String }],
  },
  { timestamps: true },
);

module.exports = mongoose.model('WorldState', worldStateSchema);
