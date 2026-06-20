const EMBED_COLORS = [
  0x8b0000,
  0x2f4f4f,
  0x4a3728,
  0x1c1c1c,
  0x5c4033,
  0x722f37,
  0x36454f,
  0x800020,
  0x4b0082,
  0x556b2f,
];

function randomEmbedColor() {
  return EMBED_COLORS[Math.floor(Math.random() * EMBED_COLORS.length)];
}

module.exports = { randomEmbedColor };
