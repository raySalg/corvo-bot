const BOT_NAME = process.env.BOT_NAME?.trim() || 'Corvo de Três Olhos';
const BOT_NAME_SHORT = process.env.BOT_NAME_SHORT?.trim() || 'Corvo';
/** Emoji usado nas reações a menções (padrão: corvo). */
const CROW_EMOJI = process.env.BOT_EMOJI?.trim() || process.env.CROW_EMOJI?.trim() || '🐦‍⬛';

module.exports = { BOT_NAME, BOT_NAME_SHORT, CROW_EMOJI };

