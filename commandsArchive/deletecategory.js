const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { checkValidUser } = require("./../handlers/permissionHandler.js");
const { openDb } = require("./../handlers/databaseHandler.js");
const { ERROR_COLOR, MOOLAH_COLOR, SUCCESS_COLOR } = require("../constants.js");
const { updateDMLog } = require("../handlers/logHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deletecategory")
    .setDescription("[DMs only] Deletes an existing category.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The category to be removed")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const userid = interaction.user.id;
    const name = interaction.options.getString("name");

    if (interaction.guild !== null) {
      interaction.editReply({
        embeds: [
          {
            description: `This command is for DMs only.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else if (name === "miscellaneous") {
      interaction.editReply({
        embeds: [
          {
            description: `The \`miscellaneous\` category is default and cannot be deleted.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else {
      let validUser = await checkValidUser(interaction);
      if (validUser) {
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
                  db.run(
                    `DELETE FROM categories WHERE userid = ? AND name = ?;`,
                    [userid, name]
                  );
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
  },
};
