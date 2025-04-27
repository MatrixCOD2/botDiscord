require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const CANAL_LISTA_BLANCA = 'lista-blanca📄';
const CANAL_LISTA_NEGRA = 'lista-negra📃';

// Función para crear los botones de Editar y Borrar
function crearBotones(mensajeId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`editar_${mensajeId || 'placeholder'}`)
        .setLabel('Editar')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(`borrar_${mensajeId || 'placeholder'}`)
        .setLabel('Borrar')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('lista')
      .setDescription('Abre un formulario'),
    new SlashCommandBuilder()
      .setName('editlista')
      .setDescription('Edita un formulario existente')
      .addStringOption(option =>
        option.setName('nick')
          .setDescription('Nick a buscar')
          .setRequired(true))
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
  // Slash command /lista
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

  // Slash command /editlista
  if (interaction.isChatInputCommand() && interaction.commandName === 'editlista') {
    const nickBuscado = interaction.options.getString('nick');

    try {
      const canales = [
        interaction.guild.channels.cache.find(c => c.name === CANAL_LISTA_BLANCA),
        interaction.guild.channels.cache.find(c => c.name === CANAL_LISTA_NEGRA)
      ].filter(Boolean);

      let mensajeEncontrado = null;
      for (const canal of canales) {
        const mensajes = await canal.messages.fetch({ limit: 100 });
        const mensaje = mensajes.find(m => m.content.includes(`**Nick:** ${nickBuscado}`));
        if (mensaje) {
          mensajeEncontrado = mensaje;
          break;
        }
      }

      if (!mensajeEncontrado) {
        return interaction.reply({
          content: `❌ No encontré ningún mensaje para el nick **${nickBuscado}**.`,
          ephemeral: true
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
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Hubo un error buscando el mensaje.',
          ephemeral: true
        });
      }
    }
  }

  // Modal submit inicial / formulario nuevo
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
      const mensaje = await canal.send({
        content: `## 📝 **Evaluación recibida**\n**Nick:** ${nick}\n**Observación:** ${observacion}\n**Tiempo:** ${tiempo}\n**Calificación:** ${calificacion}`
      });

      await mensaje.edit({
        components: crearBotones(mensaje.id)
      });

      await interaction.reply({
        content: `✅ Formulario enviado a **#${canalNombre}**.`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `❌ No se encontró el canal **#${canalNombre}**. Asegurate de crearlo.`,
        ephemeral: true
      });
    }
  }

  // Modal submit edición
  if (interaction.isModalSubmit() && interaction.customId.startsWith('editarform_')) {
    const mensajeId = interaction.customId.split('_')[1];
    const observacionNueva = interaction.fields.getTextInputValue('observacion');
    const tiempoNuevo = interaction.fields.getTextInputValue('tiempo');
    const calificacionNueva = interaction.fields.getTextInputValue('calificacion');

    const califNumNueva = parseFloat(calificacionNueva);
    if (isNaN(califNumNueva) || califNumNueva < 1 || califNumNueva > 10) {
      return await interaction.reply({
        content: '❌ La nueva calificación debe ser un número del 1 al 10.',
        ephemeral: true
      });
    }

    try {
      const canales = [
        interaction.guild.channels.cache.find(c => c.name === CANAL_LISTA_BLANCA),
        interaction.guild.channels.cache.find(c => c.name === CANAL_LISTA_NEGRA)
      ].filter(Boolean);

      let mensajeEncontrado = null;
      let canalOrigen = null;

      for (const canal of canales) {
        try {
          const mensaje = await canal.messages.fetch(mensajeId);
          if (mensaje) {
            mensajeEncontrado = mensaje;
            canalOrigen = canal;
            break;
          }
        } catch (error) {
          // ignoramos si no lo encuentra
        }
      }

      if (!mensajeEncontrado) {
        return await interaction.reply({
          content: '❌ No se encontró el mensaje original para editar.',
          ephemeral: true
        });
      }

      const matchNick = mensajeEncontrado.content.match(/\*\*Nick:\*\* (.+)/);
      const nick = matchNick ? matchNick[1].trim() : 'Desconocido';

      const nuevoContenido = `## 📝 **Evaluación actualizada**\n**Nick:** ${nick}\n**Observación:** ${observacionNueva}\n**Tiempo:** ${tiempoNuevo}\n**Calificación:** ${calificacionNueva}`;

      const canalNuevoNombre = califNumNueva >= 7 ? CANAL_LISTA_BLANCA : CANAL_LISTA_NEGRA;
      const canalNuevo = interaction.guild.channels.cache.find(c => c.name === canalNuevoNombre);

      if (!canalNuevo) {
        return await interaction.reply({
          content: `❌ No se encontró el canal destino **#${canalNuevoNombre}**.`,
          ephemeral: true
        });
      }

      if (canalOrigen.id === canalNuevo.id) {
        await mensajeEncontrado.edit({
          content: nuevoContenido,
          components: crearBotones(mensajeEncontrado.id)
        });

        await interaction.reply({
          content: '✅ Mensaje actualizado correctamente.',
          ephemeral: true
        });
      } else {
        const nuevoMensaje = await canalNuevo.send({
          content: nuevoContenido,
          components: crearBotones(null)
        });

        await nuevoMensaje.edit({
          components: crearBotones(nuevoMensaje.id)
        });

        await mensajeEncontrado.delete();

        await interaction.reply({
          content: `✅ El mensaje fue movido a **#${canalNuevoNombre}**.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('❌ Error editando mensaje:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Hubo un error al editar el mensaje.',
          ephemeral: true
        });
      }
    }
  }

  // Botones de Editar y Borrar
  if (interaction.isButton()) {
    const [accion, mensajeId] = interaction.customId.split('_');

    if (accion === 'borrar') {
      try {
        const mensaje = await interaction.channel.messages.fetch(mensajeId);
        await mensaje.delete();

        await interaction.reply({
          content: '✅ Mensaje eliminado correctamente.',
          ephemeral: true
        });
      } catch (error) {
        console.error('❌ Error eliminando mensaje:', error);
        await interaction.reply({
          content: '❌ Error eliminando el mensaje.',
          ephemeral: true
        });
      }
    }

    if (accion === 'editar') {
      try {
        const mensaje = await interaction.channel.messages.fetch(mensajeId);

        const matchNick = mensaje.content.match(/\*\*Nick:\*\* (.+)/);
        const nick = matchNick ? matchNick[1].trim() : 'Desconocido';

        const modal = new ModalBuilder()
          .setCustomId(`editarform_${mensaje.id}`)
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
      } catch (error) {
        console.error('❌ Error mostrando modal de edición:', error);
        if (!interaction.replied) {
          await interaction.reply({
            content: '❌ Hubo un error mostrando el modal.',
            ephemeral: true
          });
        }
      }
    }
  }
});

// Captura errores no controlados
process.on('unhandledRejection', error => {
  console.error('❌ Error no capturado:', error);
});

client.login(TOKEN);
