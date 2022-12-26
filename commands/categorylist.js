const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR, ERROR_COLOR } = require("../constants.js");
const { checkValidUser } = require("./../handlers/permissionHandler.js");
const { openDb } = require("./../handlers/databaseHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("categorylist")
    .setDescription("[DMs only] Displays a list of your categories."),
  async execute(interaction) {
    let db = await openDb();
    const userid = interaction.user.id;

    let validUser = await checkValidUser(interaction);
    if (validUser) {
      sql = `SELECT name FROM categories WHERE userid = ?`;
      categories = await db.all(sql, [userid]);

      categoriesStr = "";
      categories.forEach((row) => {
        categoriesStr += ` • ${row.name}\n`;
      });

      interaction.reply({
        embeds: [
          {
            color: MOOLAH_COLOR,
            title: "Category list",
            description: categoriesStr,
          },
        ],
      });
    }
  },
};
