const mongoose = require('mongoose');
const { REGIONS } = require('../constants/regions');

const ALL_REGIONS = [...Object.values(REGIONS)];

const houseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    region: {
      type: String,
      enum: ALL_REGIONS,
      required: true,
    },
    level: {
      type: String,
      enum: ['governante', 'soberano', 'menor', 'dominante', 'maior', 'dominante-regional'],
      default: 'menor',
    },
    independent: { type: Boolean, default: false },
    maxMembers: { type: Number, required: true, min: 1, default: 3 },
    goldDragons: { type: Number, default: 0 },
    annualIncome: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 1 },
    incomeSource: { type: String, default: '', trim: true },
    economySeeded: { type: Boolean, default: false },
    lordId: { type: String, default: null },
    members: [{ type: String }],
  },
  { timestamps: true },
);

houseSchema.virtual('memberCount').get(function memberCount() {
  const lordCount = this.lordId ? 1 : 0;
  return lordCount + this.members.length;
});

houseSchema.methods.hasVacancy = function hasVacancy() {
  return this.memberCount < this.maxMembers;
};

houseSchema.methods.hasLordVacancy = function hasLordVacancy() {
  return !this.lordId;
};

houseSchema.methods.isMember = function isMember(userId) {
  return this.lordId === userId || this.members.includes(userId);
};

module.exports = mongoose.model('House', houseSchema);
