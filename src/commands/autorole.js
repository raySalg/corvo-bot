const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { requireAdmin } = require('../utils/permissions');
const { sendEphemeral } = require('../utils/interactionReply');
const { randomEmbedColor } = require('../utils/embed');

const MAX_BUTTONS = 10;
const CUSTOM_ID_PREFIX = 'autorole:toggle:';

function buildCommandData() {
  const data = new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Cria um painel de auto cargo: botões para receber ou remover cargos.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('titulo')
        .setDescription('Título do painel')
        .setRequired(true)
        .setMaxLength(256),
    )
    .addStringOption((option) =>
      option
        .setName('descricao')
        .setDescription('Descrição / texto do painel')
        .setRequired(true)
        .setMaxLength(4000),
    );

  for (let i = 1; i <= MAX_BUTTONS; i += 1) {
    data.addRoleOption((option) =>
      option
        .setName(`cargo${i}`)
        .setDescription(`Cargo do botão ${i}`)
        .setRequired(i === 1),
    );
    data.addStringOption((option) =>
      option
        .setName(`botao${i}`)
        .setDescription(`Nome do botão ${i} (padrão: nome do cargo)`)
        .setRequired(false)
        .setMaxLength(80),
    );
  }

  return data;
}

function normalizeButtonLabel(raw, fallback) {
  const label = String(raw || '').trim() || String(fallback || '').trim();
  if (!label) return null;
  return label.slice(0, 80);
}

function collectEntries(interaction) {
  const entries = [];
  const seenRoles = new Set();

  for (let i = 1; i <= MAX_BUTTONS; i += 1) {
    const role = interaction.options.getRole(`cargo${i}`);
    if (!role) continue;

    if (seenRoles.has(role.id)) {
      throw new Error(`O cargo **${role.name}** foi selecionado mais de uma vez.`);
    }
    seenRoles.add(role.id);

    const label = normalizeButtonLabel(interaction.options.getString(`botao${i}`), role.name);
    if (!label) {
      throw new Error(`Informe um nome válido para o botão do cargo **${role.name}**.`);
    }

    entries.push({ role, label });
  }

  if (entries.length === 0) {
    throw new Error('Selecione pelo menos um cargo (`cargo1`).');
  }

  return entries;
}

function assertBotCanManageRole(interaction, role) {
  const me = interaction.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Eu preciso da permissão **Gerenciar Cargos** neste servidor.');
  }

  if (role.id === interaction.guild.id) {
    throw new Error('Não é possível usar o cargo @everyone.');
  }

  if (role.managed) {
    throw new Error(`O cargo **${role.name}** é gerenciado por uma integração e não pode ser atribuído.`);
  }

  if (!role.editable) {
    throw new Error(
      `Não consigo gerenciar o cargo **${role.name}**. Coloque meu cargo acima dele e verifique as permissões.`,
    );
  }
}

function buildPanelComponents(entries) {
  const rows = [];
  for (let i = 0; i < entries.length; i += 5) {
    const chunk = entries.slice(i, i + 5);
    const row = new ActionRowBuilder();
    for (const entry of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}${entry.role.id}`)
          .setLabel(entry.label)
          .setStyle(ButtonStyle.Secondary),
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildPanelEmbed({ title, description, entries, color }) {
  const list = entries.map((entry) => `• **${entry.label}** → <@&${entry.role.id}>`).join('\n');
  const body = `${description.trim()}\n\n${list}\n\n_Clique no botão para receber ou remover o cargo._`;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title.slice(0, 256))
    .setDescription(body.slice(0, 4096));
}

function parseToggleRoleId(customId) {
  if (!customId.startsWith(CUSTOM_ID_PREFIX)) return null;
  const roleId = customId.slice(CUSTOM_ID_PREFIX.length);
  return /^\d{17,20}$/.test(roleId) ? roleId : null;
}

module.exports = {
  data: buildCommandData(),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    if (!interaction.guild) {
      await sendEphemeral(interaction, '### Erro\nEste comando só funciona em um servidor.');
      return;
    }

    let entries;
    try {
      entries = collectEntries(interaction);
      for (const entry of entries) {
        assertBotCanManageRole(interaction, entry.role);
      }
    } catch (error) {
      await sendEphemeral(interaction, `### Configuração inválida\n${error.message}`);
      return;
    }

    const title = interaction.options.getString('titulo', true).trim();
    const description = interaction.options.getString('descricao', true).replace(/\\n/g, '\n').trim();
    if (!title || !description) {
      await sendEphemeral(interaction, '### Configuração inválida\nInforme título e descrição do painel.');
      return;
    }

    const channel = interaction.channel;
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
      await sendEphemeral(interaction, '### Erro\nNão consigo publicar painéis neste tipo de canal.');
      return;
    }

    const embed = buildPanelEmbed({
      title,
      description,
      entries,
      color: randomEmbedColor(),
    });
    const components = buildPanelComponents(entries);

    try {
      await channel.send({ embeds: [embed], components });
    } catch (error) {
      console.error('[Corvo] Falha ao publicar painel autorole:', error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão foi possível publicar o painel. Verifique minhas permissões de enviar mensagens e embeds.',
      );
      return;
    }

    await sendEphemeral(
      interaction,
      `### Painel criado\n${entries.length} botão(ões) publicado(s) em <#${channel.id}>.`,
    );
  },

  async handleButton(interaction) {
    const roleId = parseToggleRoleId(interaction.customId);
    if (!roleId) {
      await sendEphemeral(interaction, '### Erro\nEste botão de auto cargo é inválido.');
      return;
    }

    if (!interaction.guild || !interaction.member) {
      await sendEphemeral(interaction, '### Erro\nSó é possível usar este painel dentro do servidor.');
      return;
    }

    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      await sendEphemeral(interaction, '### Cargo indisponível\nEsse cargo não existe mais neste servidor.');
      return;
    }

    try {
      assertBotCanManageRole(interaction, role);
    } catch (error) {
      await sendEphemeral(interaction, `### Sem permissão\n${error.message}`);
      return;
    }

    const member = interaction.member;
    const hasRole = member.roles.cache.has(role.id);

    try {
      if (hasRole) {
        await member.roles.remove(role, 'Autorole: remoção via painel');
        await sendEphemeral(interaction, `### Cargo removido\nVocê não tem mais **${role.name}**.`);
      } else {
        await member.roles.add(role, 'Autorole: atribuição via painel');
        await sendEphemeral(interaction, `### Cargo adicionado\nVocê recebeu **${role.name}**.`);
      }
    } catch (error) {
      console.error('[Corvo] Falha ao alternar cargo autorole:', error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão consegui alterar seu cargo. Peça a um admin para conferir a hierarquia de cargos do bot.',
      );
    }
  },
};
