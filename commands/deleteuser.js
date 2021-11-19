const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog } = require("./../handlers/logHandler.js");
const { ERROR_COLOR, MOOLAH_COLOR, SUCCESS_COLOR } = require("../constants.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deleteuser")
    .setDescription("Deletes a user from the database.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to be deleted")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const user = interaction.options.getUser("user");

    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ?`;
    result = await db.get(sql, [user.id, interaction.guildId]);
    if (!result) {
      interaction.editReply({
        embeds: [
          {
            color: ERROR_COLOR,
            description: `User could not be deleted. <@!${user.id}> is not currently in the database.`,
          },
        ],
      });
    } else {
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
        .setTitle(`Delete this user?`)
        .setColor(MOOLAH_COLOR)
        .setDescription(
          `Deleting user <@!${user.id}> will delete them from the database. All transactions involving their user will be removed. Please consider using \`/removeuser\` if you only want to deactive this user.\n`
        );
      interaction
        .editReply({ embeds: [embed], components: [buttons] })
        .then((m) => {
          const filter = (i) => i.user.id === interaction.user.id;

          const collector = m.createMessageComponentCollector({
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
                    description: `Action timed out - user <@!${user.id}> has not been deleted.`,
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
                    description: `Action cancelled - user <@!${user.id}> has not been deleted.`,
                    color: ERROR_COLOR,
                  },
                ],
                components: [],
              });
            } else if (
              collected.entries().next().value[1].customId === "confirm"
            ) {
              interaction.editReply({
                embeds: [
                  {
                    description: `User <@!${user.id}> deleted successfully.`,
                    color: SUCCESS_COLOR,
                  },
                ],
                components: [],
              });
              db.run(`DELETE FROM users WHERE userid = ? AND serverid = ?;`, [
                user.id,
                interaction.guildId,
              ]).then(() => {
                updateLog(interaction.guild);
              });
            }
          });
        });
    }
  },
};
