const {
    Client, GatewayIntentBits,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    ActionRowBuilder, Events, REST, Routes, SlashCommandBuilder
  } = require('discord.js');
  
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  
  // ⚠️ Reemplazá estos datos:
  const TOKEN = process.env.TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;  
  const CANAL_LISTA_BLANCA = 'lista-blanca📄';
  const CANAL_LISTA_NEGRA = 'lista-negra📃';
  
  client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
  
    const commands = [
      new SlashCommandBuilder()
        .setName('lista')
        .setDescription('Abre un formulario')
    ].map(command => command.toJSON());
  
    const rest = new REST({ version: '10' }).setToken(TOKEN);
  
    try {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands },
      );
      console.log('✅ Comando registrado correctamente.');
    } catch (error) {
      console.error('❌ Error registrando comando:', error);
    }
  });
  
  client.on(Events.InteractionCreate, async interaction => {
    // Slash command
    if (interaction.isChatInputCommand() && interaction.commandName === 'lista') {
      const modal = new ModalBuilder()
        .setCustomId('formulario') // ← corregido el typo
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
  
    // Modal submit
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
          content: `## 📝 **Evaluación recibida**\n**Nick:** ${nick}\n**Observación:** ${observacion}\n**Tiempo:** ${tiempo}\n**Calificación:** ${calificacion}`
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
  });
  
  // Captura errores no controlados
  process.on('unhandledRejection', error => {
    console.error('❌ Error no capturado:', error);
  });
  
  client.login(TOKEN);
  
  
