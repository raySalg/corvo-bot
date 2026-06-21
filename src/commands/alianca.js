const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const House = require('../models/House');
const {
  proposeAlliance,
  acceptAlliance,
  dissolveAlliance,
  transferGold,
  getAlliancesForHouse,
  allianceOther,
} = require('../services/economyService');
const { autocompleteHouses } = require('../utils/houseDisplay');
const { getRegionLabel } = require('../constants/regions');
const { getWorldState } = require('../services/worldService');
const { randomEmbedColor } = require('../utils/embed');

async function ensureAllianceChannel(interaction) {
  const world = await getWorldState();

  if (!world.allianceChannelId) {
    await interaction.reply({
      content:
        '### Canal de alianças não definido\n' +
        'Um administrador precisa configurar o canal de alianças com `/economia-canais` antes de usar este comando.',
      ephemeral: true,
    });
    return false;
  }

  if (interaction.channelId !== world.allianceChannelId) {
    await interaction.reply({
      content: `### Canal incorreto\nUse os comandos de aliança apenas em <#${world.allianceChannelId}>.`,
      ephemeral: true,
    });
    return false;
  }

  return true;
}

async function getLordHouse(interaction) {
  const house = await House.findOne({ lordId: interaction.user.id });
  if (!house) {
    await interaction.reply({
      content:
        '### Apenas Senhores\nVocê precisa ser o **Senhor** de uma casa para gerenciar alianças.',
      ephemeral: true,
    });
    return null;
  }
  return house;
}

async function getTargetHouse(interaction) {
  const slug = interaction.options.getString('casa');
  const house = await House.findOne({ slug });
  if (!house) {
    await interaction.reply({
      content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
      ephemeral: true,
    });
    return null;
  }
  return house;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alianca')
    .setDescription('Gerencia as alianças da sua casa.')
    .addSubcommand((sub) =>
      sub
        .setName('propor')
        .setDescription('Propõe uma aliança a outra casa.')
        .addStringOption((option) =>
          option.setName('casa').setDescription('Casa aliada').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('aceitar')
        .setDescription('Aceita uma proposta de aliança.')
        .addStringOption((option) =>
          option.setName('casa').setDescription('Casa proponente').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('desfazer')
        .setDescription('Desfaz uma aliança ou cancela uma proposta.')
        .addStringOption((option) =>
          option.setName('casa').setDescription('Casa aliada').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('transferir')
        .setDescription('Transfere D.O. para uma casa aliada.')
        .addStringOption((option) =>
          option.setName('casa').setDescription('Casa aliada').setRequired(true).setAutocomplete(true),
        )
        .addIntegerOption((option) =>
          option.setName('valor').setDescription('Quantidade de D.O. a transferir').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) => sub.setName('listar').setDescription('Lista as alianças da sua casa.')),

  autocomplete: autocompleteHouses,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const house = await getLordHouse(interaction);
    if (!house) return;

    if (sub === 'listar') {
      return this.listar(interaction, house);
    }

    if (!(await ensureAllianceChannel(interaction))) return;

    if (sub === 'propor') {
      const target = await getTargetHouse(interaction);
      if (!target) return;
      try {
        await proposeAlliance(house, target, interaction.user.id);
      } catch (error) {
        await interaction.reply({ content: `### Proposta recusada\n${error.message}`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content:
          `### Proposta de aliança enviada\n**${house.name}** propõe aliança a **${target.name}**.\n` +
          `O Senhor de **${target.name}** deve usar \`/alianca aceitar casa: ${house.name}\` para firmar o pacto.`,
      });
      return;
    }

    if (sub === 'aceitar') {
      const target = await getTargetHouse(interaction);
      if (!target) return;
      try {
        await acceptAlliance(house, target);
      } catch (error) {
        await interaction.reply({ content: `### Não foi possível aceitar\n${error.message}`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content: `### Aliança firmada\n**${house.name}** e **${target.name}** agora são aliadas.`,
      });
      return;
    }

    if (sub === 'desfazer') {
      const target = await getTargetHouse(interaction);
      if (!target) return;
      try {
        await dissolveAlliance(house, target);
      } catch (error) {
        await interaction.reply({ content: `### Nada a desfazer\n${error.message}`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content: `### Aliança desfeita\nO pacto entre **${house.name}** e **${target.name}** foi rompido.`,
      });
      return;
    }

    if (sub === 'transferir') {
      const target = await getTargetHouse(interaction);
      if (!target) return;
      const amount = interaction.options.getInteger('valor');
      try {
        await transferGold(house, target, amount, interaction.user.id);
      } catch (error) {
        await interaction.reply({ content: `### Transferência recusada\n${error.message}`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content:
          `### Transferência concluída\n**${house.name}** enviou **${amount.toLocaleString('pt-BR')} D.O.** ` +
          `para **${target.name}**.\nCofres de ${house.name}: ${house.goldDragons.toLocaleString('pt-BR')} D.O.`,
      });
      return;
    }
  },

  async listar(interaction, house) {
    const alliances = await getAlliancesForHouse(house.slug);

    if (alliances.length === 0) {
      await interaction.reply({
        content: `### Alianças de ${house.name}\nEsta casa não possui alianças nem propostas no momento.`,
        ephemeral: true,
      });
      return;
    }

    const otherSlugs = alliances.map((alliance) => allianceOther(alliance, house.slug));
    const others = await House.find({ slug: { $in: otherSlugs } });
    const nameBySlug = new Map(others.map((h) => [h.slug, h]));

    const active = [];
    const pending = [];

    for (const alliance of alliances) {
      const otherSlug = allianceOther(alliance, house.slug);
      const other = nameBySlug.get(otherSlug);
      const label = other ? `${other.name} (${getRegionLabel(other.region)})` : otherSlug;
      if (alliance.status === 'active') {
        active.push(`• ${label}`);
      } else {
        const direction = alliance.proposedBy === house.lordId ? 'enviada' : 'recebida';
        pending.push(`• ${label} — proposta ${direction}`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle(`Alianças de ${house.name}`)
      .setTimestamp();

    if (active.length > 0) {
      embed.addFields({ name: 'Aliadas', value: active.join('\n') });
    }
    if (pending.length > 0) {
      embed.addFields({ name: 'Propostas pendentes', value: pending.join('\n') });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
