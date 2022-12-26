const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR, ERROR_COLOR } = require("../constants.js");
const { checkValidUser } = require("../handlers/permissionHandler.js");
const { openDb } = require("../handlers/databaseHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("toggleshared")
    .setDescription(
      "[DMs only] Toggles your settings to share transactions between servers and dms."
    ),
  async execute(interaction) {
    let db = await openDb();
    const userid = interaction.user.id;

    if (interaction.guild !== null) {
      interaction.reply({
        embeds: [
          {
            description: `This command is for DMs only.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else {
      let validUser = await checkValidUser(interaction);
      if (validUser) {
        sql = `SELECT shared FROM dms WHERE userid = ?`;
        dms = await db.get(sql, [userid]);

        if (dms.shared == 1) {
          db.run(`UPDATE dms SET shared = 0 WHERE userid = ?;`, [userid]);

          interaction.reply({
            embeds: [
              {
                color: MOOLAH_COLOR,
                description:
                  "Toggled **OFF**: server transactions will no longer be added to your personal transactions.",
              },
            ],
          });
        } else {
          db.run(`UPDATE dms SET shared = 1 WHERE userid = ?;`, [userid]);

          interaction.reply({
            embeds: [
              {
                color: MOOLAH_COLOR,
                description:
                  "Toggled **ON**: server transactions will now be added to your personal transactions.",
              },
            ],
          });
        }
      }
    }
  },
};
