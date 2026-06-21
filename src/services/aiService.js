const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function generateDecreeNarration({ houseName, regionLabel, authorName, content, totalSpent }) {
  if (!isConfigured()) {
    return null;
  }

  const systemPrompt =
    'Você é o Meistre cronista dos Sete Reinos, no universo de Game of Thrones. ' +
    'A partir de um decreto econômico de uma casa nobre, escreva uma narração imersiva, ' +
    'em português, no tom de crônica medieval, descrevendo as consequências práticas e ' +
    'narrativas das medidas tomadas e do ouro investido. Seja conciso (2 a 4 parágrafos curtos), ' +
    'evite repetir o texto do decreto literalmente e não invente valores numéricos diferentes ' +
    'dos informados.';

  const userPrompt =
    `Casa: ${houseName}${regionLabel ? ` (${regionLabel})` : ''}\n` +
    `Autor do decreto: ${authorName}\n` +
    `Total gasto: ${totalSpent} Dragões de Ouro\n\n` +
    `Decreto:\n${content}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...(process.env.OPENAI_PROJECT ? { 'OpenAI-Project': process.env.OPENAI_PROJECT } : {}),
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[Sete] Falha na OpenAI (${response.status}): ${errorText.slice(0, 300)}`);
      return null;
    }

    const data = await response.json();
    const narration = data?.choices?.[0]?.message?.content?.trim();
    return narration || null;
  } catch (error) {
    console.error('[Sete] Erro ao gerar narração com a OpenAI:', error.message);
    return null;
  }
}

module.exports = {
  isConfigured,
  generateDecreeNarration,
};
