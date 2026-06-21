const mongoose = require('mongoose');

const decreeSchema = new mongoose.Schema(
  {
    houseSlug: { type: String, required: true, unique: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Decree', decreeSchema);
