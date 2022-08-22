const { SlashCommandBuilder } = require("@discordjs/builders");
const { ERROR_COLOR } = require("../constants.js");
const { getLogEmbeds, getDMLogEmbed } = require("./../handlers/logHandler.js");
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
    } else {
      const now = new Date();
      const embed = await getDMLogEmbed(
        interaction.user.id,
        now.getMonth() + 1,
        now.getFullYear()
      );
      embed.footer = {
        text: "To view all previous months, jump to the pinned log message and use the buttons to scroll.",
      };

      interaction.editReply({
        embeds: [embed],
      });
      return;
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
