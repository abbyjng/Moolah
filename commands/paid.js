const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog, getLogDict } = require("./../handlers/logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");
const {
  MAX_COST,
  ERROR_COLOR,
  MOOLAH_COLOR,
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
    .setName("paid")
    .setDescription("Logs a new payment.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("value")
        .setDescription("Pay a specific value to a user")
        .addNumberOption((option) =>
          option
            .setName("cost")
            .setDescription(
              `The total value being paid [$0 > x > $${MAX_COST}]`
            )
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The person being paid")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("all")
        .setDescription("Pay all your the owed value to a user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The person being paid")
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    if (interaction.guild === null) {
      interaction.reply({
        embeds: [
          {
            description: `This command is for servers only.`,
            color: ERROR_COLOR,
          },
        ],
      });
      return;
    }

    await interaction.deferReply();

    let db = await openDb();

    let cost;
    const user = interaction.options.getUser("user");

    let validTransaction = true;

    let validUser = await checkValidUser(interaction);
    if (validUser) {
      if (interaction.options.getSubcommand() === "value") {
        cost = interaction.options.getNumber("cost");
      } else {
        // all
        sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
        let users = await db.all(sql, [interaction.guildId]);
        let log = await getLogDict(users, interaction.guildId);

        sql = `SELECT userid, emoji FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
        let recipient = await db.all(sql, [user.id, interaction.guildId]);
        if (recipient.length != 0) {
          if (user.id === interaction.user.id) {
            interaction.editReply({
              embeds: [
                {
                  color: ERROR_COLOR,
                  description: `Invalid action: you cannot log a payment to yourself.`,
                },
              ],
              components: [],
            });
            validTransaction = false;
          }
          cost = log[`${interaction.user.id}`][`${user.id}`]["value"];
          if (cost === 0) {
            interaction.editReply({
              embeds: [
                {
                  color: ERROR_COLOR,
                  description: `Invalid action: you do not owe <@!${user.id}> anything.`,
                },
              ],
              components: [],
            });
            validTransaction = false;
          }
        } else {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `<@!${user.id}> is not an active user. Use /setuser to register a new user.`,
              },
            ],
            components: [],
          });
          validTransaction = false;
        }
      }

      if (validTransaction) {
        let validChannel = await checkTransactionsChannel(
          interaction.channelId,
          interaction.guildId
        );
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
          } else if (!user) {
            // do embed
            sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
            users = await db.all(sql, [interaction.guildId]);
            (async function () {
              handlePayment(
                interaction,
                interaction.user.id,
                users,
                getFormattedUsers(users, interaction.user.id),
                cost
              ).then((recipient) => {
                if (recipient !== 0 && recipient !== -1) {
                  sql = `INSERT INTO transactions (serverid, value, description, type, category)
                                        VALUES (?, ?, "defaultPaidDescription", "SERVER", "")`;
                  db.run(sql, [interaction.guildId, cost]).then(() => {
                    db.run("SELECT last_insert_rowid()").then(
                      (transactionid) => {
                        sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                                VALUES (?, ?, ?, ?);`;
                        db.run(sql, [
                          interaction.guildId,
                          transactionid.lastID,
                          interaction.user.id,
                          recipient.userid,
                        ]).then(() => {
                          updateLog(interaction.guild);
                        });
                      }
                    );
                  });
                }
              });
            })();
          } else {
            // try tagged user
            sql = `SELECT emoji FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
            result = await db.get(sql, [user.id, interaction.guildId]);
            if (!result) {
              interaction.editReply({
                embeds: [
                  {
                    color: ERROR_COLOR,
                    description: `<@!${user.id}> is not an active user. Use /setuser to register a new user.`,
                  },
                ],
                components: [],
              });
            } else if (user.id === interaction.user.id) {
              interaction.editReply({
                embeds: [
                  {
                    color: ERROR_COLOR,
                    description: `Invalid action: you cannot log a payment to yourself.`,
                  },
                ],
                components: [],
              });
            } else {
              let userid = user.id;
              // insert into transactions
              sql = `INSERT INTO transactions (serverid, value, description, type, category)
                                VALUES (?, ?, "defaultPaidDescription", "SERVER", "")`;
              db.run(sql, [interaction.guildId, cost]).then(() => {
                db.run("SELECT last_insert_rowid()").then((transactionid) => {
                  sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                        VALUES (?, ?, ?, ?);`;
                  db.run(sql, [
                    interaction.guildId,
                    transactionid.lastID,
                    interaction.user.id,
                    userid,
                  ]).then(() => {
                    updateLog(interaction.guild);
                  });
                });
              });
              confirmPayment(
                interaction,
                interaction.user.id,
                userid,
                result.emoji,
                cost
              );
            }
          }
        } else {
          interaction.editReply({
            embeds: [
              {
                color: ERROR_COLOR,
                description: `\`/paid\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
              },
            ],
            components: [],
          });
        }
      }
    }
  },
};

async function handlePayment(interaction, authorid, users, strUsers, value) {
  return new Promise((resolve, reject) => {
    emojis = users.map((user) => {
      if (user.userid == authorid) {
        return;
      }
      if (user.emoji.charAt(0) === "<") {
        return user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1);
      } else {
        return `${user.emoji}`;
      }
    });

    rows = [];
    buttons = new MessageActionRow();

    emojis.forEach((emoji) => {
      if (emoji) {
        if (buttons.components.length == 5) {
          rows.push(buttons);
          buttons = new MessageActionRow();
        }
        buttons.addComponents(
          new MessageButton()
            .setCustomId(emoji)
            .setEmoji(emoji)
            .setStyle("SECONDARY")
        );
      }
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

    info = {
      recipient: "",
      value: value,
      emojis: emojis,
      status: StatusEnum.WORKING,
    };

    embed = new Discord.MessageEmbed()
      .setTitle(`New payment...`)
      .addFields({
        name: `Select the recipient of this payment of $${parseFloat(
          value
        ).toFixed(2)}:`,
        value: strUsers,
      })
      .setColor(MOOLAH_COLOR);
    interaction.editReply({ embeds: [embed], components: rows }).then((m) => {
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
          if (i.customId === "cancel") {
            t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
            transactionCancelled(interaction);
            resolve(0);
            // cancelled by button
            collector.stop();
          } else {
            users.forEach((u) => {
              if (
                i.customId === u.emoji ||
                i.customId === u.emoji.slice(u.emoji.indexOf(":", 2) + 1, -1)
              ) {
                t[(m.createdAt, authorid)].recipient = u;
                t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
                confirmPayment(interaction, authorid, u.userid, u.emoji, value);
                resolve(u);
                collector.stop();
              }
            });
          }
        }
      });

      collector.on("end", (collected) => {
        if (t[(m.createdAt, authorid)].status == StatusEnum.WORKING) {
          t[(m.createdAt, authorid)].status = StatusEnum.TIMEDOUT;
          transactionTimedOut(interaction);
          resolve(-1);
          // time ran out
        }
      });
    });
  });
}

function getFormattedUsers(users, userid = null) {
  formUsers = "";
  users.forEach((row) => {
    if (row.userid !== userid) {
      formUsers += `${row.emoji} → `;
      formUsers += `<@!${row.userid}>\n`;
    }
  });
  return formUsers;
}

function confirmPayment(interaction, ownerid, userid, emoji, value) {
  interaction.editReply({
    embeds: [
      {
        title: `Transaction added!`,
        color: SUCCESS_COLOR,
        description: `<@!${ownerid}> paid **$${parseFloat(value).toFixed(
          2
        )}** to ${emoji}<@!${userid}>`,
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
