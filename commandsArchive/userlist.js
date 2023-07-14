const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR, ERROR_COLOR } = require("../constants.js");
const { openDb } = require("./../handlers/databaseHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userlist")
    .setDescription(
      "Displays a list of registered users and their corresponding emojis."
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
    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
    activeUsers = await db.all(sql, [interaction.guildId]);
    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 0`;
    inactiveUsers = await db.all(sql, [interaction.guildId]);

    activeFormUsers = "";
    activeUsers.forEach((row) => {
      if (row.userid !== interaction.client.id) {
        activeFormUsers += `${row.emoji} → `;
        activeFormUsers += `<@!${row.userid}>\n`;
      }
    });

    inactiveFormUsers = "";
    inactiveUsers.forEach((row) => {
      if (row.userid !== interaction.client.id) {
        inactiveFormUsers += `${row.emoji} → `;
        inactiveFormUsers += `<@!${row.userid}>\n`;
      }
    });

    fields = [
      {
        name: `Active users`,
        value: activeFormUsers.slice(0, -1) || `No users set.`,
      },
    ];
    if (inactiveUsers.length != 0) {
      fields.push({
        name: `Inactive users`,
        value: inactiveFormUsers.slice(0, -1),
      });
    }
    interaction.reply({
      embeds: [
        {
          color: MOOLAH_COLOR,
          fields: fields,
        },
      ],
    });
  },
};
