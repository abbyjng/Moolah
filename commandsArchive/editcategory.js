const { SlashCommandBuilder } = require("@discordjs/builders");
const { ERROR_COLOR, SUCCESS_COLOR, MAX_CATEGORY } = require("../constants");
const { checkValidUser } = require("./../handlers/permissionHandler.js");
const { openDb } = require("../handlers/databaseHandler");
const { updateDMLog } = require("../handlers/logHandler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("editcategory")
    .setDescription("[DMs only] Renames a transaction category.")
    .addStringOption((option) =>
      option
        .setName("old")
        .setDescription(`The previous name of the category`)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("new")
        .setDescription(`The new name of the category [<${MAX_CATEGORY} chars]`)
        .setRequired(true)
    ),
  async execute(interaction) {
    let db = await openDb();
    const userid = interaction.user.id;
    const oldName = interaction.options.getString("old");
    const newName = interaction.options.getString("new");

    if (interaction.guild !== null) {
      interaction.reply({
        embeds: [
          {
            description: `This command is for DMs only.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else if (oldName === newName) {
      interaction.reply({
        embeds: [
          {
            description: `You entered the same category name. Try something different!`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else if (oldName === "miscellaneous") {
      interaction.reply({
        embeds: [
          {
            description: `The \`miscellaneous\` category is default and cannot be changed.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else {
      sql = `SELECT name FROM categories WHERE userid = ? AND name = ?`;
      newNameExists = await db.get(sql, [userid, newName]);
      if (newNameExists) {
        interaction.reply({
          embeds: [
            {
              description: `The category \`${newName}\` already exists.`,
              color: ERROR_COLOR,
            },
          ],
        });
      } else {
        let validUser = await checkValidUser(interaction);
        if (validUser) {
          sql = `SELECT name FROM categories WHERE userid = ? AND name = ?`;
          existingCategory = await db.get(sql, [userid, oldName]);
          if (existingCategory) {
            sql = `UPDATE categories SET name = ? WHERE userid = ? AND name = ?;`;
            db.run(sql, [newName, userid, oldName]);

            updateDMLog(interaction.user, interaction.channel);

            interaction.reply({
              embeds: [
                {
                  description: `The category \`${oldName}\` has successfully been changed to \`${newName}\`.`,
                  color: SUCCESS_COLOR,
                },
              ],
            });
          } else {
            interaction.reply({
              embeds: [
                {
                  description: `A category with the name \`${oldName}\` doesn't exist.`,
                  color: ERROR_COLOR,
                },
              ],
            });
          }
        }
      }
    }
  },
};
