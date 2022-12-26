const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const {
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");
const { ERROR_COLOR, MOOLAH_COLOR } = require("../constants.js");

let l = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Displays a list of all previous transactions."),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const userid = interaction.user.id;

    if (interaction.guild === null) {
      sql = ` SELECT 
                        value, 
                        description, 
                        category,
                        CAST(strftime('%s', created) AS INT) AS created 
                    FROM 
                        transactions 
                    WHERE 
                        serverid = ?`;

      transactions = await db.all(sql, [userid]);
      entriesPerScreen = Math.min(Math.floor(10), 10);
      transactions.sort(function (a, b) {
        if (a.created > b.created) return 1;
        else return -1;
      });

      handleLog(interaction, transactions, userid, entriesPerScreen, true);
      return;
    }

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
                        CAST(strftime('%s', created) AS INT) AS created 
                    FROM 
                        transactions 
                    WHERE 
                        serverid = ?`;

      transactionids = await db.all(sql, [interaction.guildId]);

      sql = `SELECT userid FROM users WHERE serverid = ?`;
      let numUsers = (await db.all(sql, [interaction.guildId])).length;
      let entriesPerScreen = Math.min(
        Math.floor(
          4096 / (6 + 21 + 3 + (14 + 54) * (numUsers - 1) + 13 + 102 + 11)
        ),
        10
      );

      // loop thru them all and get info for each one
      tlist = [];
      invalidTransactions = 0; // deal with this later lol
      if (transactionids.length === 0) {
        // no transactions
        noTransactions(interaction);
      }
      transactionids.forEach((id) => {
        sql = ` SELECT 
                            owner,  
                            emoji
                        FROM
                            transactionhands INNER JOIN users 
                            ON transactionhands.recipient = users.userid AND 
                                transactionhands.serverid = users.serverid
                        WHERE 
                            transactionid = ?`;
        db.all(sql, [id.transactionid]).then((tarray) => {
          if (tarray.length > 0) {
            tlist.push({
              value: id.value,
              description: id.description,
              created: id.created,
              owner: tarray[0].owner,
              emojis: tarray.map((t) => t.emoji),
            });
          } else {
            invalidTransactions += 1;
          }

          if (tlist.length + invalidTransactions === transactionids.length) {
            // sort by created
            tlist.sort(function (a, b) {
              if (a.created > b.created) return 1;
              else return -1;
            });
            handleLog(
              interaction,
              tlist,
              interaction.user.id,
              entriesPerScreen,
              false
            );
          }
        });
      });
    } else {
      interaction.editReply({
        embeds: [
          {
            color: ERROR_COLOR,
            description: `\`/history\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
          },
        ],
      });
    }
  },
};

function noTransactions(interaction) {
  embed = new Discord.MessageEmbed()
    .setTitle(`Transaction log`)
    .setColor(MOOLAH_COLOR)
    .setDescription(`No transactions found.`);
  interaction.editReply({ embeds: [embed] });
}

function handleLog(
  interaction,
  transactions,
  authorid,
  entriesPerScreen,
  isDM
) {
  const all_active_buttons = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("full_down")
      .setEmoji("⏬")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("down")
      .setEmoji("⬇️")
      .setStyle("SECONDARY"),
    new MessageButton().setCustomId("up").setEmoji("⬆️").setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("full_up")
      .setEmoji("⏫")
      .setStyle("SECONDARY")
  );

  const top_buttons = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("full_down")
      .setEmoji("⏬")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("down")
      .setEmoji("⬇️")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("up")
      .setEmoji("⬆️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("full_up")
      .setEmoji("⏫")
      .setStyle("SECONDARY")
      .setDisabled(true)
  );

  const bottom_buttons = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("full_down")
      .setEmoji("⏬")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("down")
      .setEmoji("⬇️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton().setCustomId("up").setEmoji("⬆️").setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("full_up")
      .setEmoji("⏫")
      .setStyle("SECONDARY")
  );

  const no_active_buttons = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("full_down")
      .setEmoji("⏬")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("down")
      .setEmoji("⬇️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("up")
      .setEmoji("⬆️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("full_up")
      .setEmoji("⏫")
      .setStyle("SECONDARY")
      .setDisabled(true)
  );

  embed = new Discord.MessageEmbed()
    .setTitle(`Transaction log`)
    .setColor(MOOLAH_COLOR)
    .setDescription(
      getLogMessage(
        transactions,
        Math.max(transactions.length - entriesPerScreen, 0),
        entriesPerScreen,
        isDM
      )
    );
  interaction
    .editReply({
      embeds: [embed],
      components: [
        transactions.length <= entriesPerScreen
          ? no_active_buttons
          : bottom_buttons,
      ],
    })
    .then((m) => {
      l[(m.createdAt, authorid)] = transactions.length - entriesPerScreen;
      const filter = (i) => true;

      // collector lasts for 2 minutes
      const collector = m.createMessageComponentCollector({
        filter,
        time: 300000,
        dispose: true,
      });

      function handleButton(button) {
        if (button === "full_down") {
          // go to the bottom of the list
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setColor(MOOLAH_COLOR)
            .setDescription(
              getLogMessage(
                transactions,
                Math.max(transactions.length - entriesPerScreen, 0),
                entriesPerScreen,
                isDM
              )
            );
          m.edit({ embeds: [newEmbed], components: [bottom_buttons] });
          l[(m.createdAt, authorid)] = transactions.length - entriesPerScreen;
        } else if (button === "down") {
          // go 10 down
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setColor(MOOLAH_COLOR)
            .setDescription(
              getLogMessage(
                transactions,
                Math.min(
                  l[(m.createdAt, authorid)] + entriesPerScreen,
                  Math.max(transactions.length - entriesPerScreen, 0)
                ),
                entriesPerScreen,
                isDM
              )
            );
          let new_pos = Math.min(
            l[(m.createdAt, authorid)] + entriesPerScreen,
            transactions.length - entriesPerScreen
          );
          l[(m.createdAt, authorid)] = new_pos;
          if (new_pos == transactions.length - entriesPerScreen) {
            m.edit({ embeds: [newEmbed], components: [bottom_buttons] });
          } else {
            m.edit({ embeds: [newEmbed], components: [all_active_buttons] });
          }
        } else if (button === "up") {
          // go entriesPerScreen up
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setColor(MOOLAH_COLOR)
            .setDescription(
              getLogMessage(
                transactions,
                Math.max(l[(m.createdAt, authorid)] - entriesPerScreen, 0),
                entriesPerScreen,
                isDM
              )
            );
          let new_pos = Math.max(
            l[(m.createdAt, authorid)] - entriesPerScreen,
            0
          );
          l[(m.createdAt, authorid)] = new_pos;
          if (new_pos == 0) {
            m.edit({ embeds: [newEmbed], components: [top_buttons] });
          } else {
            m.edit({ embeds: [newEmbed], components: [all_active_buttons] });
          }
        } else if (button === "full_up") {
          // go to the top of the list
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setColor(MOOLAH_COLOR)
            .setDescription(
              getLogMessage(transactions, 0, entriesPerScreen, isDM)
            );
          m.edit({ embeds: [newEmbed], components: [top_buttons] });
          l[(m.createdAt, authorid)] = 0;
        }
      }

      collector.on("collect", (i) => {
        handleButton(i.customId);
      });

      collector.on("remove", (i) => {
        handleButton(i.customId);
      });

      collector.on("end", (collected, reason) => {
        newEmbed = new Discord.MessageEmbed()
          .setTitle(`Transaction log -- Inactive`)
          .setColor(MOOLAH_COLOR)
          .setDescription(
            getLogMessage(
              transactions,
              l[(m.createdAt, authorid)],
              entriesPerScreen,
              isDM
            )
          );
        m.edit({ embeds: [newEmbed], components: [] });
      });
    });
}

function getLogMessage(transactions, startIndex, entriesPerScreen, isDM) {
  retStr = ``;
  if (!isDM) {
    for (
      var i = startIndex;
      i < Math.min(startIndex + entriesPerScreen, transactions.length);
      ++i
    ) {
      if (transactions[i].description == "defaultPaidDescription") {
        // paid
        retStr += `${i + 1}) <@!${transactions[i].owner}> paid ${
          transactions[i].emojis[0]
        } `;
        retStr += `[$${transactions[i].value.toFixed(2)}] | <t:${
          transactions[i].created
        }:d>\n`;
      } else if (transactions[i].value < 0) {
        // owe
        retStr += `${i + 1}) <@!${transactions[i].owner}> owes ${
          transactions[i].emojis[0]
        } `;
        retStr += `[$${(-transactions[i].value).toFixed(2)}] `;
        if (transactions[i].description) {
          retStr += `"${transactions[i].description}" `;
        }
        retStr += `| <t:${transactions[i].created}:d>\n`;
      } else {
        // bought
        retStr += `${i + 1}) <@!${transactions[i].owner}> → `;
        transactions[i].emojis.forEach((emoji) => {
          retStr += emoji;
        });
        if (transactions[i].emojis.length > 1) {
          retStr += ` [$${transactions[i].value.toFixed(2)}ea] `;
        } else {
          retStr += ` [$${transactions[i].value.toFixed(2)}] `;
        }
        if (transactions[i].description) {
          retStr += `"${transactions[i].description}" `;
        }
        retStr += `| <t:${transactions[i].created}:d>\n`;
      }
    }
  } else {
    for (
      var i = startIndex;
      i < Math.min(startIndex + entriesPerScreen, transactions.length);
      ++i
    ) {
      retStr += `${i + 1}) $${transactions[i].value.toFixed(2)}`;
      if (transactions[i].description) {
        retStr += ` for "${transactions[i].description}"`;
      }
      retStr += ` in category \`${transactions[i].category}\``;
      retStr += ` | <t:${transactions[i].created}:d>\n`;
    }
  }

  return retStr;
}
