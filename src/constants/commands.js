const COMMAND_CATALOG = {
  public: [
    {
      name: 'comandos',
      description: 'Lista todos os comandos disponíveis do Sete.',
    },
    {
      name: 'casas',
      description: 'Exibe as casas por região, com botões para navegar.',
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
      name: 'criar-casa',
      description: 'Fundar uma nova casa com região, nível e limite.',
    },
    {
      name: 'editar-casa',
      description: 'Editar nome, limite, nível ou região de uma casa.',
    },
    {
      name: 'deletar-casa',
      description: 'Remover uma casa do reino.',
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
