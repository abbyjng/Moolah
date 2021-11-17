const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR } = require("../constants.js");
const { openDb } = require("./../handlers/databaseHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channellist")
    .setDescription("Displays a list of the assigned channel types."),
  async execute(interaction) {
    let db = await openDb();
    sql = `SELECT transactionsid, logid, alertsid FROM servers WHERE serverid = ?`;
    val = await db.get(sql, [interaction.guildId]);
    channels = `Transactions channel: `;
    channels += val.transactionsid ? `<#${val.transactionsid}>\n` : `not set\n`;

    channels += `Money log channel: `;
    channels += val.logid ? `<#${val.logid}>\n` : `not set\n`;

    channels += `Alerts channel: `;
    channels += val.alertsid ? `<#${val.alertsid}>\n` : `not set\n`;

    interaction.reply({
      embeds: [
        {
          color: MOOLAH_COLOR,
          fields: [
            {
              name: `Channel list`,
              value: channels,
            },
          ],
        },
      ],
    });
  },
};
