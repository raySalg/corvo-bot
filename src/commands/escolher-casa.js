const { SlashCommandBuilder } = require('discord.js');
const House = require('../models/House');
const { HOUSE_LEVEL_LABELS } = require('../constants/houses');
const { REGION_LABELS } = require('../constants/regions');
const { autocompleteHouses } = require('../utils/houseDisplay');
const { findUserHouse } = require('../utils/houseMembers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('escolher-casa')
    .setDescription('Jura lealdade a uma casa de Westeros.')
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa que deseja servir')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('cargo')
        .setDescription('Cargo desejado na casa')
        .setRequired(true)
        .addChoices(
          { name: 'Senhor(a) da Casa', value: 'lorde' },
          { name: 'Membro da Casa', value: 'membro' },
        ),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    const slug = interaction.options.getString('casa');
    const role = interaction.options.getString('cargo');
    const userId = interaction.user.id;

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nEsta casa não existe nos registros de Westeros.',
        ephemeral: true,
      });
      return;
    }

    const previousHouse = await findUserHouse(userId);

    if (previousHouse && previousHouse.slug !== house.slug) {
      await interaction.reply({
        content:
          '### Lealdade já jurada\n' +
          `Você já serve a **${previousHouse.name}**. Use **/sair-da-casa** antes de jurar lealdade a outra.`,
        ephemeral: true,
      });
      return;
    }

    if (house.isMember(userId)) {
      await interaction.reply({
        content: `### Você já pertence à casa\nVocê já faz parte de **${house.name}**.`,
        ephemeral: true,
      });
      return;
    }

    if (role === 'lorde') {
      if (!house.hasLordVacancy()) {
        await interaction.reply({
          content:
            '### Vaga de Senhor(a) indisponível\n' +
            `A casa **${house.name}** já possui um Senhor(a). Escolha o cargo de **Membro** ou aguarde uma vaga.`,
          ephemeral: true,
        });
        return;
      }

      if (!house.hasVacancy()) {
        await interaction.reply({
          content:
            '### Casa lotada\n' +
            `A casa **${house.name}** está lotada (**${house.memberCount}/${house.maxMembers}**).`,
          ephemeral: true,
        });
        return;
      }

      house.lordId = userId;
      await house.save();

      await interaction.reply({
        content:
          '### Nomeação confirmada\n' +
          `Você foi nomeado **Senhor(a)** da casa **${house.name}** (${REGION_LABELS[house.region]}).\n` +
          `Classificação: **${HOUSE_LEVEL_LABELS[house.level]}**`,
      });
      return;
    }

    if (!house.hasVacancy()) {
      await interaction.reply({
        content:
          '### Casa lotada\n' +
          `A casa **${house.name}** está lotada (**${house.memberCount}/${house.maxMembers}**).`,
        ephemeral: true,
      });
      return;
    }

    house.members.push(userId);
    await house.save();

    await interaction.reply({
      content:
        '### Lealdade jurada\n' +
        `Você jurou lealdade à casa **${house.name}** (${REGION_LABELS[house.region]}) como **membro**.\n` +
        `Classificação: **${HOUSE_LEVEL_LABELS[house.level]}**`,
    });
  },
};
