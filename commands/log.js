const { SlashCommandBuilder } = require("@discordjs/builders");
const { ERROR_COLOR } = require("../constants.js");
const { getLogEmbeds } = require("./../handlers/logHandler.js");
const {
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");

let l = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription(
      "Displays the current log of balances between active users."
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let validChannel = null;
    if (interaction.guild !== null) {
      validChannel = await checkTransactionsChannel(
        interaction.channelId,
        interaction.guildId
      );
    }
    if (!validChannel) {
      interaction.editReply({ embeds: await getLogEmbeds(interaction.guild) });
    } else {
      interaction.editReply({
        color: ERROR_COLOR,
        embeds: [
          {
            description: `\`/log\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
          },
        ],
      });
    }
  },
};
