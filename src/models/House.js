const mongoose = require('mongoose');
const { HOUSE_LEVELS } = require('../constants/houses');

const houseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    level: {
      type: String,
      enum: Object.values(HOUSE_LEVELS),
      default: HOUSE_LEVELS.MENOR,
    },
    maxMembers: { type: Number, required: true, min: 1, default: 3 },
    goldDragons: { type: Number, default: 0 },
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
