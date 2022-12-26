const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  ERROR_COLOR,
  SUCCESS_COLOR,
  MAX_CATEGORY,
  MAX_CATEGORIES,
} = require("../constants");
const { checkValidUser } = require("./../handlers/permissionHandler.js");
const { openDb } = require("../handlers/databaseHandler");
const { updateDMLog } = require("../handlers/logHandler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("createcategory")
    .setDescription("[DMs only] Creates a new transaction category.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription(`The name of the category [<${MAX_CATEGORY} chars]`)
        .setRequired(true)
    ),
  async execute(interaction) {
    let db = await openDb();
    const userid = interaction.user.id;
    const name = interaction.options.getString("name");

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
        let numCategories = (
          await db.all(`SELECT name FROM categories WHERE userid = ?`, [userid])
        ).length;
        if (numCategories >= MAX_CATEGORIES) {
          interaction.reply({
            embeds: [
              {
                description: `You have reached the maximum number of categories (${MAX_CATEGORIES}). Consider deleting or editing a category instead with \`/deletecategory\` or \`/editcategory\`.`,
                color: ERROR_COLOR,
              },
            ],
          });
        } else if (name.length > MAX_CATEGORY) {
          interaction.reply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Invalid command usage: the category submitted must be <${MAX_CATEGORY} characters long.`,
              },
            ],
            components: [],
          });
        } else {
          sql = `SELECT name FROM categories WHERE userid = ? AND name = ?`;
          existingCategory = await db.get(sql, [userid, name]);
          if (!existingCategory) {
            sql = `INSERT INTO categories (userid, name) 
                        VALUES (?, ?);`;
            db.run(sql, [userid, name]);
            updateDMLog(interaction.user, interaction.channel);

            interaction.reply({
              embeds: [
                {
                  description: `The category \`${name}\` has successfully been created.`,
                  color: SUCCESS_COLOR,
                },
              ],
            });
          } else {
            interaction.reply({
              embeds: [
                {
                  description: `A category with the name \`${name}\` already exists and could not be created.`,
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
