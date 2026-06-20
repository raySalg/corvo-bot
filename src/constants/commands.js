const COMMAND_CATALOG = {
  public: [
    {
      name: 'comandos',
      description: 'Lista todos os comandos disponíveis do Sete.',
    },
    {
      name: 'casas',
      description: 'Exibe as casas de Westeros, vagas e tesouros.',
    },
    {
      name: 'escolher-casa',
      description: 'Jura lealdade a uma casa como Lorde/Lady ou membro.',
    },
  ],
  admin: [
    {
      name: 'criar-casa',
      description: 'Fundar uma nova casa com limite e classificação.',
    },
    {
      name: 'alterar-nivel-casa',
      description: 'Alterar o nível de uma casa (Imperador, Rei ou Vassala).',
    },
    {
      name: 'economia-alterar',
      description: 'Adicionar ou remover moedas de ouro do tesouro de uma casa.',
    },
    {
      name: 'falar',
      description: 'Faz o Sete proclamar uma mensagem no canal.',
    },
  ],
};

function formatCommandList(commands) {
  return commands
    .map((command) => `**/${command.name}**\n${command.description}`)
    .join('\n\n');
}

module.exports = { COMMAND_CATALOG, formatCommandList };
