const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");
const { updateLog } = require("./../logHandler.js");

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
            description: `User could not be deleted. <@!${user.id}> is not currently in the database.`,
          },
        ],
      });
    } else {
      emojis = ["❌", "✅"];

      let embed = new Discord.MessageEmbed()
        .setTitle(`Delete this user?`)
        .setDescription(
          `Deleting user <@!${user.id}> will delete them from the database. All transactions involving their user will be removed. Please consider using \`/removeuser\` if you only want to deactive this user.\n`
        )
        .setFooter(`React with ✅ to confirm or ❌ to cancel this action.`);
      interaction.editReply({ embeds: [embed] }).then((m) => {
        Promise.all([m.react("✅"), m.react("❌")]).catch((error) =>
          console.error("One of the emojis failed to react:", error)
        );

        const filter = (r, u) => {
          return emojis.includes(r.emoji.name) && u.id !== m.author.id;
        };

        // collector lasts for 2 minutes before cancelling
        const collector = m.createReactionCollector({
          filter,
          time: 120000,
          dispose: true,
        });

        collector.on("collect", (r, u) => {
          if (u.id === interaction.user.id) {
            collector.stop();
          }
        });

        collector.on("end", (collected) => {
          m.reactions
            .removeAll()
            .catch((error) =>
              console.error("Failed to clear reactions: ", error)
            );
          if (collected.length === 0) {
            interaction.editReply({
              embeds: [
                {
                  description: `Action timed out - user <@!${user.id}> has not been deleted.`,
                  color: 0xff0000,
                },
              ],
            });
          } else if (collected.keys().next().value === "❌") {
            interaction.editReply({
              embeds: [
                {
                  description: `Action cancelled - user <@!${user.id}> has not been deleted.`,
                  color: 0xff0000,
                },
              ],
            });
          } else if (collected.keys().next().value === "✅") {
            interaction.editReply({
              embeds: [
                {
                  description: `User <@!${user.id}> deleted successfully.`,
                  color: 0x00ff00,
                },
              ],
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
