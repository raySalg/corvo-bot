const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { WORLD_STATUS } = require('../../constants/world');
const { getPlayableRegionChoices } = require('../../constants/regions');
const { requireAdmin } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');
const {
  setWesterosGovernante,
  setWorldStatus,
  submitRegion,
} = require('../../services/worldService');
const { buildWesterosEmbed } = require('../../utils/westerosEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editar-westeros')
    .setDescription('Edita o status político de Westeros (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Define a situação geral do reino.')
        .addStringOption((option) =>
          option
            .setName('situacao')
            .setDescription('Situação de Westeros')
            .setRequired(true)
            .addChoices(
              { name: 'Estável', value: WORLD_STATUS.ESTAVEL },
              { name: 'Conflito entre as Casas', value: WORLD_STATUS.CONFLITO },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('casa-conflito-1')
            .setDescription('Primeira casa envolvida no conflito')
            .setRequired(false)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName('casa-conflito-2')
            .setDescription('Segunda casa envolvida no conflito')
            .setRequired(false)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName('casa-conflito-3')
            .setDescription('Terceira casa envolvida no conflito')
            .setRequired(false)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName('casa-conflito-4')
            .setDescription('Quarta casa envolvida no conflito')
            .setRequired(false)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('governante')
        .setDescription('Define quem é o Governante de Westeros.')
        .addStringOption((option) =>
          option
            .setName('casa')
            .setDescription('Casa Governante de Westeros')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submeter-regiao')
        .setDescription('Remove a independência de uma região.')
        .addStringOption((option) =>
          option
            .setName('regiao')
            .setDescription('Região a submeter novamente ao reino')
            .setRequired(true)
            .addChoices(...getPlayableRegionChoices()),
        ),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'status') {
        const situacao = interaction.options.getString('situacao');
        const conflictSlugs = ['casa-conflito-1', 'casa-conflito-2', 'casa-conflito-3', 'casa-conflito-4']
          .map((key) => interaction.options.getString(key))
          .filter(Boolean);

        if (situacao === WORLD_STATUS.CONFLITO && conflictSlugs.length === 0) {
          await interaction.reply({
            content:
              '### Casas em conflito\n' +
              'Informe ao menos uma casa ao definir **Conflito entre as Casas**.',
            ephemeral: true,
          });
          return;
        }

        if (conflictSlugs.length > 0) {
          const found = await House.find({ slug: { $in: conflictSlugs } });
          if (found.length !== conflictSlugs.length) {
            await interaction.reply({
              content: '### Casa inválida\nUma ou mais casas de conflito não foram encontradas.',
              ephemeral: true,
            });
            return;
          }
        }

        await setWorldStatus(situacao, situacao === WORLD_STATUS.CONFLITO ? conflictSlugs : []);
      }

      if (subcommand === 'governante') {
        await setWesterosGovernante(interaction.options.getString('casa'));
      }

      if (subcommand === 'submeter-regiao') {
        await submitRegion(interaction.options.getString('regiao'));
      }

      const embed = await buildWesterosEmbed();

      await interaction.reply({
        content: '### Westeros atualizado\nO status do mundo foi alterado.',
        embeds: [embed],
      });
    } catch (error) {
      await interaction.reply({
        content: `### Erro\n${error.message}`,
        ephemeral: true,
      });
    }
  },
};
