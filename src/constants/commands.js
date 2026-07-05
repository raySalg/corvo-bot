const { BOT_NAME_SHORT } = require('./bot');

const COMMAND_CATALOG = {
  public: [
    {
      name: 'comandos',
      description: `Lista todos os comandos disponíveis do ${BOT_NAME_SHORT}.`,
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
    {
      name: 'economia',
      description: 'Exibe a ficha econômica de uma casa (cofres, rendimento e aliados).',
    },
    {
      name: 'decreto',
      description: 'Senhor da casa envia o Decreto Econômico (um por casa) via formulário.',
    },
    {
      name: 'construir',
      description: 'Senhor da casa ergue estruturas (custo imediato, rendimento anual).',
    },
    {
      name: 'alianca',
      description: 'Alianças comerciais: propor, aceitar, desfazer, listar e transferir D.O.',
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
      name: 'economia-definir',
      description: 'Define rendimento, cofres, taxa e fonte econômica de uma casa.',
    },
    {
      name: 'economia-ciclo',
      description: 'Avança o ano: rendimentos, estruturas, manutenção, tributos e decretos.',
    },
    {
      name: 'economia-rank',
      description: 'Ranking das casas por cofres ou rendimentos anuais.',
    },
    {
      name: 'economia-canais',
      description: 'Define os canais de decretos e de alianças.',
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
      description: `Faz o ${BOT_NAME_SHORT} proclamar uma mensagem no canal.`,
    },
    {
      name: 'embed',
      description: 'Abre formulário para publicar embed com título, corpo multilinha, cor, imagem e rodapé.',
    },
  ],
};

function formatCommandList(commands) {
  return commands
    .map((command) => `**/${command.name}**\n${command.description}`)
    .join('\n\n');
}

module.exports = { COMMAND_CATALOG, formatCommandList };
