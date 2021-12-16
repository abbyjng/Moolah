const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog } = require("./../handlers/logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");
const { ERROR_COLOR, MOOLAH_COLOR, SUCCESS_COLOR } = require("../constants.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Removes a transaction from the log.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("number")
        .setDescription("Delete a specific number transaction")
        .addIntegerOption((option) =>
          option
            .setName("transaction")
            .setDescription("The number of the transaction to be deleted")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("last")
        .setDescription("Delete the most recent transaction")
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();

    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
    let validUser = await checkValidUser(interaction);
    if (validUser) {
      let validChannel = await checkTransactionsChannel(
        interaction.channelId,
        interaction.guildId
      );
      if (!validChannel) {
        // get all transactionids in this server
        sql = ` SELECT 
                            transactionid, 
                            value, 
                            description, 
                            created 
                        FROM 
                            transactions 
                        WHERE 
                            serverid = ?`;

        transactionids = await db.all(sql, [interaction.guildId]);

        let num;

        if (interaction.options.getSubcommand() === "number") {
          num = interaction.options.getInteger("transaction");
        } else {
          // last
          num = transactionids.length;
        }

        if (num <= 0) {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Invalid command usage: the value submitted must be a positive value.`,
              },
            ],
          });
        } else if (num > transactionids.length) {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Invalid command usage: ${num} is not a valid transaction number.`,
              },
            ],
          });
        } else {
          transactionids.sort(function (a, b) {
            if (a.created > b.created) return 1;
            else return -1;
          });

          sql = ` SELECT 
                                owner,  
                                emoji
                            FROM
                                transactionhands INNER JOIN users 
                                ON transactionhands.recipient = users.userid AND 
                                    transactionhands.serverid = users.serverid
                            WHERE 
                                transactionid = ?`;

          recipients = await db.all(sql, [
            transactionids[num - 1].transactionid,
          ]);

          (async function () {
            handleDelete(
              interaction,
              interaction.user.id,
              transactionids[num - 1],
              recipients,
              num - 1
            ).then((result) => {
              if (result === 1) {
                transactionid = transactionids[num - 1].transactionid;
                db.run(
                  `DELETE FROM transactions WHERE serverid = ? AND transactionid = ?;`,
                  [interaction.guildId, transactionid]
                ).then(() => {
                  updateLog(interaction.guild);
                });
                db.run(
                  `DELETE FROM transactionhands WHERE serverid = ? AND transactionid = ?;`,
                  [interaction.guildId, transactionid]
                );
              }
            });
          })();
        }
      } else {
        interaction.editReply({
          embeds: [
            {
              color: ERROR_COLOR,
              description: `\`/delete\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handleDelete(
  interaction,
  authorid,
  transaction,
  recipients,
  number
) {
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

    var descString = `**Transaction #${number + 1}:**\n`;
    if (transaction.description == "defaultPaidDescription") {
      descString += `<@!${recipients[0].owner}> paid ${recipients[0].emoji} `;
      descString += `[$${transaction.value.toFixed(2)}] | ${getFormattedDate(
        transaction.created
      )}\n`;
    } else if (transaction.value < 0) {
      // owe
      descString += `<@!${recipients[0].owner}> owes ${recipients[0].emoji} `;
      descString += `[$${(-transaction.value).toFixed(2)}] `;
      if (transaction.description) {
        descString += `"${transaction.description}" `;
      }
      descString += `| ${getFormattedDate(transaction.created)}\n`;
    } else {
      descString += `<@!${recipients[0].owner}> → `;
      recipients.forEach((recipient) => {
        descString += recipient.emoji;
      });
      if (recipients.length > 1) {
        descString += ` [$${transaction.value.toFixed(2)}ea] `;
      } else {
        descString += ` [$${transaction.value.toFixed(2)}] `;
      }
      if (transaction.description) {
        descString += `"${transaction.description}" `;
      }
      descString += `| ${getFormattedDate(transaction.created)}\n`;
    }

    embed = new Discord.MessageEmbed()
      .setTitle(`Delete this transaction?`)
      .setColor(MOOLAH_COLOR)
      .setDescription(descString);
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
          if (reason === "time") {
            interaction.editReply({
              embeds: [
                {
                  description: `Action timed out - transaction #${
                    number + 1
                  } has not been deleted.`,
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
                  description: `Action cancelled - transaction #${
                    number + 1
                  } has not been deleted.`,
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
                  description: `Transaction #${
                    number + 1
                  } deleted successfully.`,
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

function getFormattedDate(date) {
  date = new Date(date + "Z");
  d = date.getDate();
  m = date.getMonth() + 1;
  y = date.getFullYear();
  return m + "-" + (d <= 9 ? "0" + d : d) + "-" + y;
}
