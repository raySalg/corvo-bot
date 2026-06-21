const COMMAND_CATALOG = {
  public: [
    {
      name: 'comandos',
      description: 'Lista todos os comandos disponíveis do Sete.',
    },
    {
      name: 'westeros',
      description: 'Exibe quem governa Westeros e o status político do reino.',
    },
    {
      name: 'casas',
      description: 'Exibe Governante, casas independentes e regiões.',
    },
    {
      name: 'escolher-casa',
      description: 'Jura lealdade a uma casa como Senhor(a) ou membro.',
    },
    {
      name: 'sair-da-casa',
      description: 'Abandona a casa à qual você pertence.',
    },
    {
      name: 'membros-casa',
      description: 'Lista os membros de uma casa sem notificar ninguém.',
    },
  ],
  admin: [
    {
      name: 'editar-westeros',
      description: 'Edita status, conflitos, Governante e submissão de regiões.',
    },
    {
      name: 'regiao-independente',
      description: 'Declara região independente com Casa Governante regional.',
    },
    {
      name: 'criar-casa',
      description: 'Fundar casa com região (ou sem terras), nível e limite.',
    },
    {
      name: 'editar-casa',
      description: 'Editar nome, limite, nível, região ou independência.',
    },
    {
      name: 'deletar-casa',
      description: 'Remover uma casa do reino.',
    },
    {
      name: 'alterar-nivel-casa',
      description: 'Alterar classificação entre Governante, Soberano ou Vassala.',
    },
    {
      name: 'economia-alterar',
      description: 'Adicionar ou remover moedas de ouro do tesouro de uma casa.',
    },
    {
      name: 'definir-casa',
      description: 'Definir a casa e cargo de um jogador específico.',
    },
    {
      name: 'expulsar-casa',
      description: 'Remover um jogador de uma casa.',
    },
    {
      name: 'reiniciar-casas',
      description: 'Restaurar todas as casas ao estado inicial (requer confirmação).',
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
