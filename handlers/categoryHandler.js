const Discord = require("discord.js");
const {
  ERROR_COLOR,
  SUCCESS_COLOR,
  MOOLAH_COLOR,
  MAX_CATEGORY,
  MAX_CATEGORIES,
} = require("../constants");
const { openDb } = require("../handlers/databaseHandler");
const { updateDMLog } = require("../handlers/logHandler");
const { MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
  listCategory,
  createCategory,
  deleteCategory,
  editCategory,
};

async function listCategory(interaction) {
  let db = await openDb();
  const userid = interaction.user.id;

  sql = `SELECT name FROM categories WHERE userid = ?`;
  categories = await db.all(sql, [userid]);

  categoriesStr = "";
  categories.forEach((row) => {
    categoriesStr += ` • ${row.name}\n`;
  });

  interaction.editReply({
    embeds: [
      {
        color: MOOLAH_COLOR,
        title: "Category list",
        description: categoriesStr,
      },
    ],
  });
}

async function createCategory(interaction, name) {
  let db = await openDb();
  const userid = interaction.user.id;

  let numCategories = (
    await db.all(`SELECT name FROM categories WHERE userid = ?`, [userid])
  ).length;
  if (numCategories >= MAX_CATEGORIES) {
    interaction.editReply({
      embeds: [
        {
          description: `You have reached the maximum number of categories (${MAX_CATEGORIES}). Consider deleting or editing a category instead with \`/deletecategory\` or \`/editcategory\`.`,
          color: ERROR_COLOR,
        },
      ],
    });
  } else if (name.length > MAX_CATEGORY) {
    interaction.editReply({
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

      interaction.editReply({
        embeds: [
          {
            description: `The category \`${name}\` has successfully been created.`,
            color: SUCCESS_COLOR,
          },
        ],
      });
    } else {
      interaction.editReply({
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

async function deleteCategory(interaction, name) {
  let db = await openDb();
  const userid = interaction.user.id;

  if (name === "miscellaneous") {
    interaction.editReply({
      embeds: [
        {
          description: `The \`miscellaneous\` category is default and cannot be deleted.`,
          color: ERROR_COLOR,
        },
      ],
    });
  } else {
    sql = `SELECT name FROM categories WHERE userid = ? AND name = ?`;
    existingCategory = await db.get(sql, [userid, name]);
    if (existingCategory) {
      const buttons = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("confirm")
          .setLabel("Confirm")
          .setStyle("SUCCESS"),
        new MessageButton()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle("DANGER")
      );

      let embed = new Discord.MessageEmbed()
        .setTitle(`Delete this category?`)
        .setColor(MOOLAH_COLOR)
        .setDescription(
          `Deleting the category \`${name}\` will cause all existing transactions in this category to be moved to \`miscellaneous\`.\n`
        );
      interaction
        .editReply({ embeds: [embed], components: [buttons] })
        .then((m) => {
          const filter = (i) => i.user.id === interaction.user.id;

          const collector = m.channel.createMessageComponentCollector({
            filter,
            time: 120000,
            dispose: true,
          });

          collector.on("collect", (i) => {
            collector.stop();
          });

          collector.on("end", (collected, reason) => {
            if (reason === "time") {
              interaction.editReply({
                embeds: [
                  {
                    description: `Action timed out - the category \`${name}\` has not been deleted.`,
                    color: ERROR_COLOR,
                  },
                ],
                components: [],
              });
            } else if (
              collected.entries().next().value[1].customId === "cancel"
            ) {
              interaction.editReply({
                embeds: [
                  {
                    description: `Action cancelled - the category \`${name}\` has not been deleted.`,
                    color: ERROR_COLOR,
                  },
                ],
                components: [],
              });
            } else if (
              collected.entries().next().value[1].customId === "confirm"
            ) {
              db.run(`DELETE FROM categories WHERE userid = ? AND name = ?;`, [
                userid,
                name,
              ]);
              db.run(
                `UPDATE transactions SET category = "miscellaneous" WHERE serverid = ? AND category = ?;`,
                [userid, name]
              );

              updateDMLog(interaction.user, interaction.channel);

              interaction.editReply({
                embeds: [
                  {
                    description: `The category \`${name}\` was deleted successfully.`,
                    color: SUCCESS_COLOR,
                  },
                ],
                components: [],
              });
            }
          });
        });
    } else {
      interaction.editReply({
        embeds: [
          {
            description: `A category with the name \`${name}\` doesn't exist.`,
            color: ERROR_COLOR,
          },
        ],
      });
    }
  }
}

async function editCategory(interaction, oldName, newName) {
  let db = await openDb();
  const userid = interaction.user.id;

  if (oldName === newName) {
    interaction.editReply({
      embeds: [
        {
          description: `You entered the same category name. Try something different!`,
          color: ERROR_COLOR,
        },
      ],
    });
  } else if (oldName === "miscellaneous") {
    interaction.editReply({
      embeds: [
        {
          description: `The \`miscellaneous\` category is default and cannot be changed.`,
          color: ERROR_COLOR,
        },
      ],
    });
  } else if (newName.length > MAX_CATEGORY) {
    interaction.editReply({
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
    newNameExists = await db.get(sql, [userid, newName]);
    if (newNameExists) {
      interaction.editReply({
        embeds: [
          {
            description: `The category \`${newName}\` already exists.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else {
      sql = `SELECT name FROM categories WHERE userid = ? AND name = ?`;
      existingCategory = await db.get(sql, [userid, oldName]);
      if (existingCategory) {
        sql = `UPDATE categories SET name = ? WHERE userid = ? AND name = ?;`;
        db.run(sql, [newName, userid, oldName]);

        updateDMLog(interaction.user, interaction.channel);

        interaction.editReply({
          embeds: [
            {
              description: `The category \`${oldName}\` has successfully been changed to \`${newName}\`.`,
              color: SUCCESS_COLOR,
            },
          ],
        });
      } else {
        interaction.editReply({
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
