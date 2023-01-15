const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { SUCCESS_COLOR, ERROR_COLOR } = require("../constants.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearchannel")
    .setDescription("Clears the assignment of a channel type.")
    .addStringOption((option) =>
      option
        .setName("channeltype")
        .setDescription("The type of channel being cleared")
        .setRequired(true)
        .addChoices(
          { name: "transactions", value: "transactions" },
          { name: "log", value: "log" },
          { name: "alerts", value: "alerts" }
        )
    ),
  async execute(interaction) {
    if (interaction.guild === null) {
      interaction.reply({
        embeds: [
          {
            description: `This command is for servers only.`,
            color: ERROR_COLOR,
          },
        ],
      });
      return;
    }

    let db = await openDb();
    const channelType = interaction.options.getString("channeltype");

    switch (channelType) {
      case "transactions":
        sql = `UPDATE servers SET transactionsid = "" WHERE serverid = ?;`;
        break;
      case "log":
        sql = `UPDATE servers SET logid = "" WHERE serverid = ?;`;
        break;
      case "alerts":
        sql = `UPDATE servers SET alertsid = "" WHERE serverid = ?;`;
        break;
    }
    db.run(sql, [interaction.guildId]).then(() => {
      interaction.reply({
        embeds: [
          {
            color: SUCCESS_COLOR,
            description: `The ${channelType} channel has been cleared successfully.`,
          },
        ],
      });
    });
  },
};
