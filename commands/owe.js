const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../handlers/databaseHandler.js");
const { updateLog } = require("./../handlers/logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../handlers/permissionHandler.js");
const {
  MAX_DESCRIPTION,
  MAX_OWE,
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
    .setName("owe")
    .setDescription("Logs that you owe some amount to another user.")
    .addNumberOption((option) =>
      option
        .setName("cost")
        .setDescription(`The total value owed [$0 > x > $${MAX_OWE}]`)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The person whom you owe")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription(
          `The description of the transaction [<${MAX_DESCRIPTION} chars]`
        )
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const cost = interaction.options.getNumber("cost");
    const user = interaction.options.getUser("user");
    const description = interaction.options.getString("description");

    let validUser = await checkValidUser(interaction);
    if (validUser) {
      let validChannel = await checkTransactionsChannel(
        interaction.channelId,
        interaction.guildId
      );
      if (!validChannel) {
        if (cost <= 0) {
          interaction.editReply({
            color: ERROR_COLOR,
            embeds: [
              {
                description: `Invalid command usage: the value submitted must be a positive value.`,
              },
            ],
          });
        } else if (cost >= MAX_OWE) {
          interaction.editReply({
            color: ERROR_COLOR,
            embeds: [
              {
                description: `Invalid command usage: the value submitted must be less than ${MAX_OWE}.`,
              },
            ],
          });
        } else if (description && description.length > MAX_DESCRIPTION) {
          interaction.editReply({
            color: ERROR_COLOR,
            embeds: [
              {
                description: `Invalid command usage: the description submitted must be <${MAX_DESCRIPTION} characters long.`,
              },
            ],
          });
        } else if (!user) {
          // do embed
          sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
          users = await db.all(sql, [interaction.guildId]);
          (async function () {
            handleOwe(
              interaction,
              interaction.user.id,
              users,
              getFormattedUsers(users, interaction.user.id),
              cost,
              description
            ).then((recipient) => {
              if (recipient !== 0 && recipient !== -1) {
                sql = `INSERT INTO transactions (serverid, value, description)
                                        VALUES (?, ?, ?)`;
                db.run(sql, [interaction.guildId, -cost, description]).then(
                  () => {
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
                  }
                );
              }
            });
          })();
        } else {
          // try tagged user
          sql = `SELECT emoji FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
          result = await db.get(sql, [user.id, interaction.guildId]);
          if (!result) {
            interaction.editReply({
              color: ERROR_COLOR,
              embeds: [
                {
                  description: `<@!${user.id}> is not an active user. Use /setuser to register a new user.`,
                },
              ],
            });
          } else if (user.id === interaction.user.id) {
            interaction.editReply({
              color: ERROR_COLOR,
              embeds: [
                {
                  description: `Invalid action: you cannot log a debt to yourself.`,
                },
              ],
            });
          } else {
            let userid = user.id;
            // insert into transactions
            sql = `INSERT INTO transactions (serverid, value, description)
                                VALUES (?, ?, ?)`;
            db.run(sql, [interaction.guildId, -cost, description]).then(() => {
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
            confirmDebt(
              interaction,
              interaction.user.id,
              userid,
              result.emoji,
              cost,
              description
            );
          }
        }
      } else {
        interaction.editReply({
          color: ERROR_COLOR,
          embeds: [
            {
              description: `\`/owe\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handleOwe(
  interaction,
  authorid,
  users,
  strUsers,
  value,
  description
) {
  return new Promise((resolve, reject) => {
    emojis = users.map((user) => {
      if (user.emoji.charAt(0) === "<") {
        return user.emoji.slice(2, user.emoji.indexOf(":", 2));
      } else {
        return `${user.emoji}`;
      }
    });
    emojis.push("❌");

    info = {
      recipient: "",
      value: value,
      description: description,
      emojis: emojis,
      status: StatusEnum.WORKING,
    };

    msg = `Select the recipient of this debt of $${parseFloat(value).toFixed(
      2
    )}`;
    if (info.description) {
      msg += ` for "${info.description}":`;
    } else {
      msg += `:`;
    }
    embed = new Discord.MessageEmbed()
      .setTitle(`New debt...`)
      .addFields({
        name: msg,
        value: strUsers,
      })
      .setColor(MOOLAH_COLOR);
    interaction.editReply({ embeds: [embed] }).then((m) => {
      t[(m.createdAt, authorid)] = info;

      Promise.all(
        users
          .map((user) => {
            if (user.userid != authorid) {
              if (user.emoji.charAt(0) === "<") {
                return m.react(
                  user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1)
                );
              } else {
                return m.react(user.emoji);
              }
            }
          })
          .concat([m.react("❌")])
      ).catch((error) =>
        console.error("One of the emojis failed to react:", error)
      );

      const filter = (reaction, user) => {
        return (
          t[(m.createdAt, authorid)].emojis.includes(reaction.emoji.name) &&
          user.id !== m.author.id
        );
      };

      // collector lasts for 2 minutes before cancelling
      const collector = m.createReactionCollector({
        filter,
        time: 120000,
        dispose: true,
      });

      collector.on("collect", (reaction, user) => {
        if (user.id === authorid) {
          if (reaction.emoji.name === "❌") {
            t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
            transactionCancelled(interaction);
            resolve(0);
            // cancelled by button
            collector.stop();
          } else {
            users.forEach((u) => {
              if (
                reaction.emoji.name === u.emoji ||
                reaction.emoji.name ===
                  u.emoji.slice(2, u.emoji.indexOf(":", 2))
              ) {
                t[(m.createdAt, authorid)].recipient = u;
                t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
                confirmDebt(
                  interaction,
                  authorid,
                  u.userid,
                  u.emoji,
                  value,
                  description
                );
                resolve(u);
                collector.stop();
              }
            });
          }
        }
      });

      collector.on("end", (collected) => {
        m.reactions
          .removeAll()
          .catch((error) =>
            console.error("Failed to clear reactions: ", error)
          );
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

function confirmDebt(interaction, ownerid, userid, emoji, value, description) {
  let msg = `<@!${ownerid}> owes **$${parseFloat(value).toFixed(
    2
  )}** to ${emoji}<@!${userid}>\n`;

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
  });
  return;
}
