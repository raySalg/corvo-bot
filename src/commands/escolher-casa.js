const { SlashCommandBuilder } = require('discord.js');
const House = require('../models/House');
const { HOUSE_LEVEL_LABELS } = require('../constants/houses');

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
          { name: 'Lorde/Lady da Casa', value: 'lorde' },
          { name: 'Membro da Casa', value: 'membro' },
        ),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const houses = await House.find({
      name: { $regex: focused, $options: 'i' },
    })
      .limit(25)
      .select('name slug level maxMembers lordId members');

    await interaction.respond(
      houses.map((house) => {
        const vacancies = house.maxMembers - (house.lordId ? 1 : 0) - house.members.length;
        return {
          name: `${house.name} (${HOUSE_LEVEL_LABELS[house.level]}) — ${vacancies} vagas`,
          value: house.slug,
        };
      }),
    );
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

    const previousHouse = await House.findOne({
      $or: [{ lordId: userId }, { members: userId }],
    });

    if (previousHouse && previousHouse.slug !== house.slug) {
      await interaction.reply({
        content:
          '### Lealdade já jurada\n' +
          `Você já serve a **${previousHouse.name}**. Abandone sua casa atual antes de jurar lealdade a outra.`,
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
            '### Vaga de Lorde/Lady indisponível\n' +
            `A casa **${house.name}** já possui um Lorde/Lady. Escolha o cargo de **Membro** ou aguarde uma vaga.`,
          ephemeral: true,
        });
        return;
      }

      if (!house.hasVacancy()) {
        await interaction.reply({
          content:
            '### Casa lotada\n' +
            `A casa **${house.name}** está lotada (**${house.memberCount}/${house.maxMembers}**). Não há vagas disponíveis.`,
          ephemeral: true,
        });
        return;
      }

      house.lordId = userId;
      await house.save();

      await interaction.reply({
        content:
          '### Nomeação confirmada\n' +
          `Você foi nomeado **Lorde/Lady** da casa **${house.name}**.\n` +
          'Que os deuses antigos e os novos guiem seu reinado.',
      });
      return;
    }

    if (!house.hasVacancy()) {
      await interaction.reply({
        content:
          '### Casa lotada\n' +
          `A casa **${house.name}** está lotada (**${house.memberCount}/${house.maxMembers}**). Não há vagas para novos membros.`,
        ephemeral: true,
      });
      return;
    }

    house.members.push(userId);
    await house.save();

    await interaction.reply({
      content:
        '### Lealdade jurada\n' +
        `Você jurou lealdade à casa **${house.name}** como **membro**.\n` +
        'Longa vida à sua Casa.',
    });
  },
};
