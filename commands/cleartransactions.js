const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog, updateDMLog } = require("./../handlers/logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");
const { ERROR_COLOR, MOOLAH_COLOR, SUCCESS_COLOR } = require("../constants.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cleartransactions")
    .setDescription("Clears all transactions from the log."),
  async execute(interaction) {
    const isDM = interaction.guild === null;

    await interaction.deferReply();

    let db = await openDb();

    let validUser = await checkValidUser(interaction);
    if (validUser) {
      let validChannel = null;
      if (!isDM) {
        validChannel = await checkTransactionsChannel(
          interaction.channelId,
          interaction.guildId
        );
      }

      if (!validChannel) {
        (async function () {
          handleClear(interaction, isDM).then((result) => {
            if (result === 1) {
              if (isDM) {
                db.run(`DELETE FROM transactions WHERE serverid = ?;`, [
                  interaction.user.id,
                ]).then(() => {
                  updateDMLog(interaction.user, interaction.channel);
                });
              } else {
                db.run(`DELETE FROM transactions WHERE serverid = ?;`, [
                  interaction.guildId,
                ]).then(() => {
                  updateLog(interaction.guild);
                });
                db.run(`DELETE FROM transactionhands WHERE serverid = ?;`, [
                  interaction.guildId,
                ]);
              }
            }
          });
        })();
      } else {
        interaction.editReply({
          color: ERROR_COLOR,
          embeds: [
            {
              description: `\`/cleartransactions\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handleClear(interaction, isDM) {
  return new Promise((resolve, reject) => {
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
      .setColor(MOOLAH_COLOR)
      .setDescription(
        `**Warning:** By confirming this action, all transactions logged  ${isDM ? "for this user" : "in this server"
        } will be permanently deleted. Do you wish to continue?`
      );
    interaction
      .editReply({ embeds: [embed], components: [buttons] })
      .then((m) => {
        const filter = (i) => i.user.id === interaction.user.id;

        // collector lasts for 2 minutes before cancelling
        const collector = m.createMessageComponentCollector({
          filter,
          time: 120000,
          dispose: true,
        });

        collector.on("collect", (i) => {
          collector.stop();
        });

        collector.on("end", (collected, reason) => {
          if (collected.length === 0) {
            resolve(-1);
            interaction.editReply({
              embeds: [
                {
                  description: `Action timed out - transactions have not been cleared.`,
                  color: ERROR_COLOR,
                },
              ],
              components: [],
            });
          } else if (
            collected.entries().next().value[1].customId === "cancel"
          ) {
            resolve(0);
            interaction.editReply({
              embeds: [
                {
                  description: `Action cancelled - transactions have not been cleared.`,
                  color: ERROR_COLOR,
                },
              ],
              components: [],
            });
          } else if (
            collected.entries().next().value[1].customId === "confirm"
          ) {
            resolve(1);
            interaction.editReply({
              embeds: [
                {
                  description: `Transactions cleared successfully.`,
                  color: SUCCESS_COLOR,
                },
              ],
              components: [],
            });
          }
        });
      });
  });
}
