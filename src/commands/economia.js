const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const House = require('../models/House');
const {
  getSuzerain,
  getAlliancesForHouse,
  allianceOther,
} = require('../services/economyService');
const { autocompleteHouses } = require('../utils/houseDisplay');
const { getRegionLabel } = require('../constants/regions');
const { getHouseLevelLabel } = require('../constants/houses');
const { randomEmbedColor } = require('../utils/embed');

function formatGold(value) {
  return `${(value ?? 0).toLocaleString('pt-BR')} D.O.`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia')
    .setDescription('Exibe a ficha econômica de uma casa.')
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa a consultar (padrão: a sua, se for membro)')
        .setRequired(false)
        .setAutocomplete(true),
    ),

  autocomplete: autocompleteHouses,

  async execute(interaction) {
    const slug = interaction.options.getString('casa');

    let house;
    if (slug) {
      house = await House.findOne({ slug });
    } else {
      const userId = interaction.user.id;
      house = await House.findOne({ $or: [{ lordId: userId }, { members: userId }] });
    }

    if (!house) {
      await interaction.reply({
        content: slug
          ? '### Casa não encontrada\nNenhuma casa corresponde a essa busca.'
          : '### Casa não encontrada\nInforme uma casa ou junte-se a uma para ver sua economia.',
        ephemeral: true,
      });
      return;
    }

    const suzerain = await getSuzerain(house);
    const alliances = await getAlliancesForHouse(house.slug, { status: 'active' });

    let alliesText = 'Nenhuma';
    if (alliances.length > 0) {
      const slugs = alliances.map((alliance) => allianceOther(alliance, house.slug));
      const allies = await House.find({ slug: { $in: slugs } }).select('name');
      alliesText = allies.map((ally) => ally.name).join(', ') || 'Nenhuma';
    }

    const taxPercent = Math.round((house.taxRate ?? 0) * 100);

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle(`Economia — Casa ${house.name}`)
      .setDescription(`${getHouseLevelLabel(house)} · ${getRegionLabel(house.region)}`)
      .addFields(
        { name: 'Cofres Totais', value: formatGold(house.goldDragons), inline: true },
        { name: 'Rendimento Anual', value: formatGold(house.annualIncome), inline: true },
        { name: 'Taxa de imposto', value: `${taxPercent}%`, inline: true },
        { name: 'Fonte econômica', value: house.incomeSource || '—', inline: true },
        { name: 'Suserano', value: suzerain ? suzerain.name : 'Independente / Coroa', inline: true },
        { name: 'Aliadas', value: alliesText, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
