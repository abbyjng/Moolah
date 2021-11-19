const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog } = require("./../handlers/logHandler.js");
const { ERROR_COLOR, MOOLAH_COLOR, SUCCESS_COLOR } = require("../constants.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removeuser")
    .setDescription("Removes a user from the active userlist.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to be removed")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const user = interaction.options.getUser("user");

    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
    result = await db.get(sql, [user.id, interaction.guildId]);
    if (!result) {
      interaction.editReply({
        embeds: [
          {
            color: ERROR_COLOR,
            description: `User could not be removed. <@!${user.id}> is not currently active.`,
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
        .setTitle(`Remove this user?`)
        .setColor(MOOLAH_COLOR)
        .setDescription(
          `Removing user <@!${user.id}> will remove them from the list of active users and not allow them to create new transactions. They will still appear in the transaction log.\n`
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
                    description: `Action timed out - user <@!${user.id}> has not been removed.`,
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
                    description: `Action cancelled - user <@!${user.id}> has not been removed.`,
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
                    description: `User <@!${user.id}> removed successfully.`,
                    color: SUCCESS_COLOR,
                  },
                ],
                components: [],
              });
              db.run(
                `UPDATE users SET status = 0 WHERE userid = ? AND serverid = ?;`,
                [user.id, interaction.guildId]
              ).then(() => {
                updateLog(interaction.guild);
              });
            }
          });
        });
    }
  },
};
