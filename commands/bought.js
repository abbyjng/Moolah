const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog, updateDMLog } = require("./../handlers/logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");
const {
  MAX_DESCRIPTION,
  MAX_COST,
  MOOLAH_COLOR,
  ERROR_COLOR,
  SUCCESS_COLOR,
} = require("./../constants.js");

const StatusEnum = Object.freeze({
  WORKING: 1,
  GOOD: 2,
  CANCELLED: 3,
  TIMEDOUT: 4,
});

let t = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bought")
    .setDescription("Logs a new transaction.")
    .addNumberOption((option) =>
      option
        .setName("cost")
        .setDescription(`The total value being charged [$0 > x > $${MAX_COST}]`)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription(
          `The description of the transaction [<${MAX_DESCRIPTION} chars]`
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription(
          `[DMs only] The category of the transaction; category must exist`
        )
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const cost = interaction.options.getNumber("cost");
    const description = interaction.options.getString("description");
    let category = interaction.options.getString("category");

    let validUser = await checkValidUser(interaction);
    if (validUser) {
      let validChannel = null;
      if (interaction.guild !== null) {
        validChannel = await checkTransactionsChannel(
          interaction.channelId,
          interaction.guildId
        );
      }

      if (!validChannel) {
        if (cost <= 0) {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Invalid command usage: the value submitted must be a positive value.`,
              },
            ],
            components: [],
          });
        } else if (cost >= MAX_COST) {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Invalid command usage: the value submitted must be less than ${MAX_COST}.`,
              },
            ],
            components: [],
          });
        } else if (description === "defaultPaidDescription") {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Congrats! You've found the one description message you are not allowed to use. Please try again.`,
              },
            ],
            components: [],
          });
        } else if (description && description.length > MAX_DESCRIPTION) {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Invalid command usage: the description submitted must be <${MAX_DESCRIPTION} characters long.`,
              },
            ],
            components: [],
          });
        } else if (interaction.guild === null) {
          category = category || "miscellaneous";

          let sql = `SELECT name FROM categories WHERE userid = ? AND name = ?`;
          exists = (await db.get(sql, [interaction.user.id, category])) != null;
          if (exists) {
            let sql = `INSERT INTO transactions (serverid, value, description, type, category)
                                        VALUES (?, ?, ?, "DM", ?);`;
            db.run(sql, [interaction.user.id, cost, description, category]);

            updateDMLog(interaction.user, interaction.channel);

            confirmDMTransaction(interaction, cost, description, category);
          } else {
            interaction.editReply({
              embeds: [
                {
                  color: ERROR_COLOR,
                  description: `\`${category}\` is not a valid category. Create it by using \`/createcategory ${category}\`.`,
                },
              ],
              components: [],
            });
          }
        } else if (category) {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `Categories are currently only compatible with DM transaction tracking. Try out my personal transaction tracking by sending \`/setup\` in my DMs.`,
              },
            ],
            components: [],
          });
        } else {
          let sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
          users = await db.all(sql, [interaction.guildId]);
          (async function () {
            handleTransaction(
              interaction,
              interaction.user.id,
              users,
              getFormattedUsers(users),
              cost,
              description
            ).then((recipients) => {
              if (recipients[0] !== 0 && recipients[0] !== -1) {
                let sql = `INSERT INTO transactions (serverid, value, description, type, category)
                                        VALUES (?, ?, ?, "SERVER", "");`;
                db.run(sql, [
                  interaction.guildId,
                  cost / recipients.length,
                  description,
                ]).then(() => {
                  db.run("SELECT last_insert_rowid()").then((transactionid) => {
                    recipients.forEach((recipient) => {
                      let sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                                    VALUES (?, ?, ?, ?);`;
                      db.run(sql, [
                        interaction.guildId,
                        transactionid.lastID,
                        interaction.user.id,
                        recipient.userid,
                      ]).then(() => {
                        let sql = `SELECT shared FROM dms WHERE userid = ?;`;
                        db.get(sql, [recipient.userid]).then((dmUser) => {
                          if (dmUser && dmUser.shared == 1) {
                            let sql = `INSERT INTO transactions (serverid, value, description, type, category)
                                                     VALUES (?, ?, ?, "DM", "miscellaneous");`;
                            db.run(sql, [
                              recipient.userid,
                              cost / recipients.length,
                              `"${description}" from "${interaction.guild.name}"`,
                            ]).then(() => {
                              interaction.guild.members
                                .fetch(recipient.userid)
                                .then((userToAddTransaction) => {
                                  userToAddTransaction.user
                                    .createDM()
                                    .then((dmChannel) => {
                                      updateDMLog(
                                        userToAddTransaction,
                                        dmChannel
                                      );

                                      userToAddTransaction.user
                                        .send({
                                          embeds: [
                                            {
                                              description: `New transaction: ${description
                                                ? `"${description}"`
                                                : "(no description)"
                                                } from server "${interaction.guild.name
                                                }", costing $${(
                                                  cost / recipients.length
                                                ).toFixed(2)}`,
                                              color: SUCCESS_COLOR,
                                            },
                                          ],
                                        })
                                        .catch(() => {
                                          let sql = `DELETE FROM users WHERE userid = ?`;
                                          db.run(sql, [member.id]);
                                        });
                                    });
                                });
                            });
                          }
                        });
                      });
                    });
                    updateLog(interaction.guild);
                  });
                });
              }
            });
          })();
        }
      } else {
        interaction.editReply({
          embeds: [
            {
              color: ERROR_COLOR,
              description: `\`/bought\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
          components: [],
        });
      }
    }
  },
};

async function handleTransaction(
  interaction,
  authorid,
  users,
  strUsers,
  value,
  description
) {
  return new Promise((resolve, reject) => {
    const emojis = users.map((user) => {
      if (user.emoji.charAt(0) === "<") {
        return user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1);
      } else {
        return `${user.emoji}`;
      }
    });

    let info = {
      recipients: [],
      value: value,
      description: description,
      emojis: emojis,
      status: StatusEnum.WORKING,
    };

    let embed = new Discord.MessageEmbed()
      .setTitle(`New transaction...`)
      .setColor(MOOLAH_COLOR)
      .addFields(
        { name: `Select recipients of this transaction:`, value: strUsers },
        {
          name: `Current recipients:`,
          value: getInfoString(info, users.length),
        }
      );
    interaction
      .editReply({
        embeds: [embed],
        components: getButtons(emojis, { recipients: [] }),
      })
      .then((m) => {
        t[(m.createdAt, authorid)] = info;

        const filter = (i) => i.user.id === interaction.user.id;

        // collector lasts for 2 minutes before cancelling
        const collector = m.createMessageComponentCollector({
          filter,
          time: 120000,
          dispose: true,
        });

        collector.on("collect", (i) => {
          if (i.user.id === authorid) {
            if (i.customId === "confirm") {
              if (t[(m.createdAt, authorid)].recipients.length == 0) {
                t[(m.createdAt, authorid)].recipients = users;
              }
              if (
                t[(m.createdAt, authorid)].recipients.length == 1 &&
                t[(m.createdAt, authorid)].recipients[0].userid == authorid
              ) {
                t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
                transactionInvalid(interaction);
                resolve([0]);
                // cancelled for invalid inputs
                collector.stop();
              } else {
                t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
                confirmServerTransaction(
                  interaction,
                  interaction.user.id,
                  t[(m.createdAt, authorid)].recipients,
                  value,
                  description
                );
                resolve(t[(m.createdAt, authorid)].recipients);
                // confirm transaction
                collector.stop();
              }
            } else if (i.customId === "cancel") {
              t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
              transactionCancelled(interaction);
              resolve([0]);
              // cancelled by button
              collector.stop();
            } else {
              users.forEach((u) => {
                if (
                  i.customId === u.emoji ||
                  i.customId === u.emoji.slice(u.emoji.indexOf(":", 2) + 1, -1)
                ) {
                  let found = false;
                  for (
                    let i = 0;
                    i < t[(m.createdAt, authorid)].recipients.length;
                    ++i
                  ) {
                    if (
                      t[(m.createdAt, authorid)].recipients[i].userid ===
                      u.userid
                    ) {
                      t[(m.createdAt, authorid)].recipients.splice(i, 1);
                      found = true;
                    }
                  }
                  if (!found) {
                    t[(m.createdAt, authorid)].recipients.push(u);
                  }
                }
              });
              let newEmbed = new Discord.MessageEmbed()
                .setTitle(`New transaction...`)
                .setColor(MOOLAH_COLOR)
                .addFields(
                  {
                    name: `Select recipients of this transaction:`,
                    value: strUsers,
                  },
                  {
                    name: `Current recipients:`,
                    value: getInfoString(
                      t[(m.createdAt, authorid)],
                      users.length
                    ),
                  }
                );
              i.update({
                embeds: [newEmbed],
                components: getButtons(emojis, t[(m.createdAt, authorid)]),
              });
            }
          }
        });

        collector.on("end", (collected, reason) => {
          if (t[(m.createdAt, authorid)].status == StatusEnum.WORKING) {
            t[(m.createdAt, authorid)].status = StatusEnum.TIMEDOUT;
            transactionTimedOut(interaction);
            resolve([-1]);
            // time ran out
          }
        });
      });
  });
}

function getButtons(emojis, info) {
  let rows = [];
  let buttons = new MessageActionRow();
  if (info.recipients.length == 0) {
    buttons.addComponents(
      new MessageButton()
        .setCustomId("confirm")
        .setLabel("All")
        .setStyle("SUCCESS")
    );
  } else {
    buttons.addComponents(
      new MessageButton()
        .setCustomId("confirm")
        .setLabel("Confirm")
        .setStyle("SUCCESS")
    );
  }
  emojis.forEach((emoji) => {
    if (buttons.components.length == 5) {
      rows.push(buttons);
      buttons = new MessageActionRow();
    }
    let style = "SECONDARY";
    info.recipients.forEach((user) => {
      if (
        emoji === user.emoji ||
        emoji === user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1)
      ) {
        style = "PRIMARY";
      }
    });
    buttons.addComponents(
      new MessageButton().setCustomId(emoji).setEmoji(emoji).setStyle(style)
    );
  });

  if (buttons.components.length == 5) {
    rows.push(buttons);
    buttons = new MessageActionRow();
  }

  buttons.addComponents(
    new MessageButton()
      .setCustomId("cancel")
      .setLabel("Cancel")
      .setStyle("DANGER")
  );

  rows.push(buttons);
  return rows;
}

function getFormattedUsers(users, userid = null) {
  let formUsers = "";
  users.forEach((row) => {
    if (row.userid !== userid) {
      formUsers += `${row.emoji} → `;
      formUsers += `<@!${row.userid}>\n`;
    }
  });
  return formUsers;
}

function getInfoString(info, totalUsers) {
  let retStr = "";

  if (info.recipients.length == 0) {
    retStr += `All (default)\n`;
  } else {
    info.recipients.forEach((user) => {
      retStr += `<@!${user.userid}>, `;
    });
    retStr = retStr.slice(0, -2) + `\n`;
  }

  retStr += `Total charge: **$${parseFloat(info.value).toFixed(2)}**\n`;
  if (info.recipients.length == 0) {
    retStr += `Each charged: **$${(info.value / totalUsers).toFixed(2)}**\n`;
  } else {
    retStr += `Each charged: **$${(info.value / info.recipients.length).toFixed(
      2
    )}**\n`;
  }
  if (!info.description) {
    retStr += `**Message:** N/A`;
  } else {
    retStr += `**Message:** ${info.description}`;
  }

  return retStr;
}

function confirmServerTransaction(
  interaction,
  ownerid,
  recipients,
  value,
  description
) {
  let msg = `<@!${ownerid}> purchased **$${parseFloat(value).toFixed(2)}** for `;
  recipients.forEach((user) => {
    msg += user.emoji;
    msg += `<@!${user.userid}>, `;
  });
  msg = msg.slice(0, -2) + `\n`;
  msg += `→ charging **$${(value / recipients.length).toFixed(
    2
  )}** to each recipient\n`;
  if (!description) {
    msg += `**Message:** N/A\n`;
  } else {
    msg += `**Message:** ${description}\n`;
  }
  interaction.editReply({
    embeds: [
      {
        title: `Transaction added!`,
        color: SUCCESS_COLOR,
        description: msg,
      },
    ],
    components: [],
  });
}

function confirmDMTransaction(interaction, value, description, category) {
  let msg = `Cost: **$${parseFloat(value).toFixed(2)}**\n`;
  if (!description) {
    msg += `Description: none\n`;
  } else {
    msg += `Description: **${description}**\n`;
  }
  msg += `Category: **${category}**`;
  interaction.editReply({
    embeds: [
      {
        title: `Transaction added!`,
        color: SUCCESS_COLOR,
        description: msg,
      },
    ],
    components: [],
  });
}

function transactionInvalid(interaction) {
  interaction.editReply({
    embeds: [
      {
        description: `Invalid input. You may not submit a transaction for only yourself.`,
        color: ERROR_COLOR,
      },
    ],
    components: [],
  });
}

function transactionCancelled(interaction) {
  interaction.editReply({
    embeds: [
      {
        description: `Transaction was cancelled.`,
        color: ERROR_COLOR,
      },
    ],
    components: [],
  });
}

function transactionTimedOut(interaction) {
  interaction.editReply({
    embeds: [
      {
        description: `Transaction timed out after 2 minutes.`,
        color: ERROR_COLOR,
      },
    ],
    components: [],
  });
  return;
}
