const {
  Client, GatewayIntentBits,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, Events, REST, Routes, SlashCommandBuilder,
  ButtonBuilder, ButtonStyle
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CANAL_LISTA_BLANCA = 'lista-blanca📄';
const CANAL_LISTA_NEGRA = 'lista-negra📃';

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('lista')
      .setDescription('Abre un formulario'),
    new SlashCommandBuilder()
      .setName('editlista')
      .setDescription('Edita un formulario existente por nick')
      .addStringOption(option =>
        option.setName('nick')
          .setDescription('Nick a editar')
          .setRequired(true)
      )
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Comandos registrados correctamente.');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  // Comando /lista
  if (interaction.isChatInputCommand() && interaction.commandName === 'lista') {
    const modal = new ModalBuilder()
      .setCustomId('formulario')
      .setTitle('Formulario');

    const nickInput = new TextInputBuilder()
      .setCustomId('nick')
      .setLabel('Nick')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const obsInput = new TextInputBuilder()
      .setCustomId('observacion')
      .setLabel('Observación')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const tiempoInput = new TextInputBuilder()
      .setCustomId('tiempo')
      .setLabel('Tiempo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const califInput = new TextInputBuilder()
      .setCustomId('calificacion')
      .setLabel('Calificación (número del 1 al 10)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nickInput),
      new ActionRowBuilder().addComponents(obsInput),
      new ActionRowBuilder().addComponents(tiempoInput),
      new ActionRowBuilder().addComponents(califInput)
    );

    await interaction.showModal(modal);
  }

  // Comando /editlista
  if (interaction.isChatInputCommand() && interaction.commandName === 'editlista') {
    const nickBuscado = interaction.options.getString('nick');

    await interaction.deferReply({ ephemeral: true });

    try {
      const canales = [
        interaction.guild.channels.cache.find(c => c.name === CANAL_LISTA_BLANCA),
        interaction.guild.channels.cache.find(c => c.name === CANAL_LISTA_NEGRA)
      ].filter(Boolean); // saca undefined si alguno no existe

      let mensajeEncontrado = null;
      let canalEncontrado = null;

      for (const canal of canales) {
        const mensajes = await canal.messages.fetch({ limit: 100 });
        const mensaje = mensajes.find(m => m.content.includes(`**Nick:** ${nickBuscado}`));

        if (mensaje) {
          mensajeEncontrado = mensaje;
          canalEncontrado = canal;
          break;
        }
      }

      if (!mensajeEncontrado) {
        return await interaction.editReply({
          content: `❌ No encontré ningún mensaje para el nick **${nickBuscado}**.`
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`editarform_${mensajeEncontrado.id}`)
        .setTitle(`Editar evaluación de ${nickBuscado}`);

      const obsInput = new TextInputBuilder()
        .setCustomId('observacion')
        .setLabel('Nueva Observación')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const tiempoInput = new TextInputBuilder()
        .setCustomId('tiempo')
        .setLabel('Nuevo Tiempo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const califInput = new TextInputBuilder()
        .setCustomId('calificacion')
        .setLabel('Nueva Calificación (1-10)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(obsInput),
        new ActionRowBuilder().addComponents(tiempoInput),
        new ActionRowBuilder().addComponents(califInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error('❌ Error buscando mensaje:', error);
      await interaction.editReply({
        content: '❌ Hubo un error buscando el mensaje.'
      });
    }
  }

  // Modal submit - formulario de creación
  if (interaction.isModalSubmit() && interaction.customId === 'formulario') {
    const nick = interaction.fields.getTextInputValue('nick');
    const observacion = interaction.fields.getTextInputValue('observacion');
    const tiempo = interaction.fields.getTextInputValue('tiempo');
    const calificacion = interaction.fields.getTextInputValue('calificacion');

    const califNum = parseFloat(calificacion);
    if (isNaN(califNum) || califNum < 1 || califNum > 10) {
      return await interaction.reply({
        content: '❌ La calificación debe ser un número del 1 al 10.',
        ephemeral: true
      });
    }

    const canalNombre = califNum >= 7 ? CANAL_LISTA_BLANCA : CANAL_LISTA_NEGRA;
    const canal = interaction.guild.channels.cache.find(c => c.name === canalNombre);

    if (canal) {
      await canal.send({
        content: `## 📝 **Evaluación recibida**\n**Nick:** ${nick}\n**Observación:** ${observacion}\n**Tiempo:** ${tiempo}\n**Calificación:** ${calificacion}`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`editar_${nick}`)
              .setLabel('Editar')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`borrar_${nick}`)
              .setLabel('Borrar')
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });

      await interaction.reply({
        content: `✅ Formulario enviado a **#${canalNombre}**.`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `❌ No se encontró el canal **#${canalNombre}**. Asegúrate de crearlo.`,
        ephemeral: true
      });
    }
  }

  // Modal submit - formulario de edición
  if (interaction.isModalSubmit() && interaction.customId.startsWith('editarform_')) {
    const messageId = interaction.customId.split('_')[1];
    const observacion = interaction.fields.getTextInputValue('observacion');
    const tiempo = interaction.fields.getTextInputValue('tiempo');
    const calificacion = interaction.fields.getTextInputValue('calificacion');

    const califNum = parseFloat(calificacion);
    if (isNaN(califNum) || califNum < 1 || califNum > 10) {
      return await interaction.reply({
        content: '❌ La calificación debe ser un número del 1 al 10.',
        ephemeral: true
      });
    }

    try {
      const canal = interaction.channel;
      const mensajeOriginal = await canal.messages.fetch(messageId);

      if (mensajeOriginal) {
        await mensajeOriginal.edit({
          content: `## 📝 **Evaluación EDITADA**\n**Observación:** ${observacion}\n**Tiempo:** ${tiempo}\n**Calificación:** ${calificacion}`,
          components: mensajeOriginal.components
        });

        await interaction.reply({ content: '✅ Mensaje editado.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ No se encontró el mensaje.', ephemeral: true });
      }
    } catch (error) {
      console.error('❌ Error editando mensaje:', error);
      await interaction.reply({ content: '❌ Error editando el mensaje.', ephemeral: true });
    }
  }

  // Botones (Editar y Borrar)
  if (interaction.isButton()) {
    const [action, nick] = interaction.customId.split('_');

    if (action === 'editar') {
      const modal = new ModalBuilder()
        .setCustomId(`editarform_${interaction.message.id}`)
        .setTitle(`Editar evaluación de ${nick}`);

      const obsInput = new TextInputBuilder()
        .setCustomId('observacion')
        .setLabel('Nueva Observación')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const tiempoInput = new TextInputBuilder()
        .setCustomId('tiempo')
        .setLabel('Nuevo Tiempo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const califInput = new TextInputBuilder()
        .setCustomId('calificacion')
        .setLabel('Nueva Calificación (1-10)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(obsInput),
        new ActionRowBuilder().addComponents(tiempoInput),
        new ActionRowBuilder().addComponents(califInput)
      );

      await interaction.showModal(modal);
    } else if (action === 'borrar') {
      await interaction.message.delete();
      await interaction.reply({ content: '✅ Mensaje eliminado.', ephemeral: true });
    }
  }
});

// Captura errores no controlados
process.on('unhandledRejection', error => {
  console.error('❌ Error no capturado:', error);
});

client.login(TOKEN);