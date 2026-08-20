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

function parseEmbedColor(input) {
  const trimmed = input.trim();

  const rgbMatch = trimmed.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (rgbMatch) {
    const channels = rgbMatch.slice(1).map(Number);
    if (channels.some((value) => value < 0 || value > 255)) {
      throw new Error('Cada canal RGB deve estar entre 0 e 255.');
    }
    const [r, g, b] = channels;
    return (r << 16) + (g << 8) + b;
  }

  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return parseInt(hex, 16);
  }

  throw new Error('Use RGB (ex: 255,0,0) ou hexadecimal (ex: #FF0000).');
}

function parseImageUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    throw new Error('Informe uma URL válida para a imagem.');
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Informe uma URL válida para a imagem (ex: https://exemplo.com/imagem.png).');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('A imagem deve usar URL http ou https.');
  }

  return url.toString();
}

module.exports = { randomEmbedColor, parseEmbedColor, parseImageUrl };
