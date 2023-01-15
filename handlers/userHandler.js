const Discord = require("discord.js");
const { MessageActionRow, MessageButton } = require("discord.js");
const {
  MAX_USERS,
  ERROR_COLOR,
  SUCCESS_COLOR,
  MOOLAH_COLOR,
} = require("../constants");
const { openDb } = require("./databaseHandler");
const { updateLog } = require("./../handlers/logHandler.js");

const emojiRegex = require("emoji-regex/RGI_Emoji.js");
const regex = emojiRegex();

module.exports = {
  listUser,
  setUser,
  removeUser,
  deleteUser,
};

async function listUser(interaction) {
  let db = await openDb();
  sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
  activeUsers = await db.all(sql, [interaction.guildId]);
  sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 0`;
  inactiveUsers = await db.all(sql, [interaction.guildId]);

  activeFormUsers = "";
  activeUsers.forEach((row) => {
    if (row.userid !== interaction.client.id) {
      activeFormUsers += `${row.emoji} → `;
      activeFormUsers += `<@!${row.userid}>\n`;
    }
  });

  inactiveFormUsers = "";
  inactiveUsers.forEach((row) => {
    if (row.userid !== interaction.client.id) {
      inactiveFormUsers += `${row.emoji} → `;
      inactiveFormUsers += `<@!${row.userid}>\n`;
    }
  });

  fields = [
    {
      name: `Active users`,
      value: activeFormUsers.slice(0, -1) || `No users set.`,
    },
  ];
  if (inactiveUsers.length != 0) {
    fields.push({
      name: `Inactive users`,
      value: inactiveFormUsers.slice(0, -1),
    });
  }
  interaction.editReply({
    embeds: [
      {
        color: MOOLAH_COLOR,
        fields: fields,
      },
    ],
  });
}

async function setUser(interaction, user, emojiStr) {
  let db = await openDb();

  if (emojiStr == "⬜") {
    interaction.editReply({
      embeds: [
        {
          description: `Emoji could not be set. ⬜ is an invalid emoji, try something else.`,
          color: ERROR_COLOR,
        },
      ],
    });
  } else {
    let result = await db.all(
      `SELECT userid FROM users WHERE serverid = ? AND userid = ?`,
      [interaction.guildId, user.id]
    );
    let numUsers = (
      await db.all(`SELECT userid FROM users WHERE serverid = ?`, [
        interaction.guildId,
      ])
    ).length;
    if (result && numUsers >= MAX_USERS) {
      interaction.editReply({
        embeds: [
          {
            description: `User could not be set. ${MAX_USERS} users have already been set in this server. You can delete users by running \`/deleteuser\`.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else {
      sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ? AND status = 1`;
      result = await db.get(sql, [emojiStr, interaction.guildId]);
      if (result) {
        interaction.editReply({
          embeds: [
            {
              description: `Emoji could not be set. ${emojiStr} has already been assigned to <@${result.userid}>.`,
              color: ERROR_COLOR,
            },
          ],
        });
      } else {
        if (emojiStr.charAt(0) == "<") {
          // server specific emoji
          // search for emoji within server
          emoji = interaction.guild.emojis.cache.find(
            (emoji) =>
              emoji.id === emojiStr.slice(emojiStr.indexOf(":", 2) + 1, -1)
          );
          if (!emoji) {
            // emoji doesn't exist in server
            interaction.editReply({
              embeds: [
                {
                  description: `Emoji could not be set. Emojis must be default or available in this server.`,
                  color: ERROR_COLOR,
                },
              ],
            });
          } else {
            sql = `INSERT OR REPLACE INTO users (serverid, userid, emoji, status) 
              VALUES (?, ?, ?, 1);`;
            db.run(sql, [interaction.guildId, user.id, emojiStr]).then(() => {
              updateLog(interaction.guild);
            });
            interaction.editReply({
              embeds: [
                {
                  description: `User <@!${user.id}> successfully set to ${emojiStr}.`,
                  color: SUCCESS_COLOR,
                },
              ],
            });
          }
        } else if (!isValidEmoji(emojiStr)) {
          // emoji is not a regex
          interaction.editReply({
            embeds: [
              {
                description: `Emoji could not be set. \`${emojiStr}\` is an invalid emoji.`,
                color: ERROR_COLOR,
              },
            ],
          });
        } else {
          // default emoji
          sql = `INSERT OR REPLACE INTO users (serverid, userid, emoji, status) 
              VALUES (?, ?, ?, 1);`;
          db.run(sql, [interaction.guildId, user.id, emojiStr]).then(() => {
            updateLog(interaction.guild);
          });
          interaction.editReply({
            embeds: [
              {
                description: `User <@!${user.id}> successfully set to ${emojiStr}.`,
                color: SUCCESS_COLOR,
              },
            ],
          });
        }
      }
    }
  }
}

async function removeUser(interaction, user) {
  let db = await openDb();

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
}

async function deleteUser(interaction, user) {
  let db = await openDb();

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
}

function isValidEmoji(emojiStr) {
  let match;
  let emojisFound = 0;
  let fullEmoji = "";
  while ((match = regex.exec(emojiStr))) {
    emojisFound++;
    fullEmoji += match[0];
  }
  if (fullEmoji != emojiStr) {
    return false;
  }
  return emojisFound == 1;
}
