const { Permissions } = require("discord.js");
const { ERROR_COLOR, SUCCESS_COLOR, MOOLAH_COLOR } = require("../constants");
const { openDb } = require("./databaseHandler");
const { updateLog } = require("./logHandler.js");

module.exports = {
  listChannel,
  setChannel,
  unsetChannel,
};

async function listChannel(interaction) {
  let db = await openDb();
  sql = `SELECT transactionsid, logid, alertsid FROM servers WHERE serverid = ?`;
  val = await db.get(sql, [interaction.guildId]);
  channels = `Transactions channel: `;
  channels += val.transactionsid ? `<#${val.transactionsid}>\n` : `not set\n`;

  channels += `Money log channel: `;
  channels += val.logid ? `<#${val.logid}>\n` : `not set\n`;

  channels += `Alerts channel: `;
  channels += val.alertsid ? `<#${val.alertsid}>\n` : `not set\n`;

  interaction.editReply({
    embeds: [
      {
        color: MOOLAH_COLOR,
        fields: [
          {
            name: `Channel list`,
            value: channels,
          },
        ],
      },
    ],
  });
}

async function setChannel(interaction, type, channel) {
  let db = await openDb();

  if (
    channel.type == "GUILD_TEXT" &&
    channel
      .permissionsFor(channel.guild.me)
      .has(Permissions.FLAGS.SEND_MESSAGES) &&
    channel.permissionsFor(channel.guild.me).has(Permissions.FLAGS.VIEW_CHANNEL)
  ) {
    switch (type) {
      case "transactions":
        sql = `UPDATE servers SET transactionsid = ? WHERE serverid = ?;`;
        db.run(sql, [channel.id, interaction.guildId]).then(() => {
          interaction.editReply({
            embeds: [
              {
                description: `<#${channel.id}> has successfully been set as the transactions channel.`,
                color: SUCCESS_COLOR,
              },
            ],
          });
        });
        break;
      case "log":
        sql = `UPDATE servers SET logid = ? WHERE serverid = ?;`;
        db.run(sql, [channel.id, interaction.guildId]).then(() => {
          updateLog(interaction.guild, channel.id);
          interaction.editReply({
            embeds: [
              {
                description: `<#${channel.id}> has successfully been set as the money log channel.`,
                color: SUCCESS_COLOR,
              },
            ],
          });
        });
        break;
      case "alerts":
        sql = `UPDATE servers SET alertsid = ? WHERE serverid = ?;`;
        db.run(sql, [channel.id, interaction.guildId]).then(() => {
          interaction.editReply({
            embeds: [
              {
                description: `<#${channel.id}> has successfully been set as the alerts channel.`,
                color: SUCCESS_COLOR,
              },
            ],
          });
        });
        break;
      default:
        interaction.editReply({
          embeds: [
            {
              description: `Invalid channel type. Valid types: \`transactions | log | alerts\``,
              color: ERROR_COLOR,
            },
          ],
        });
    }
  } else {
    interaction.editReply({
      embeds: [
        {
          description: `Channel could not be set. Make sure this bot has permissions to send messages in <#${channel.id}>`,
          color: ERROR_COLOR,
        },
      ],
    });
  }
}

async function unsetChannel(interaction, type) {
  let db = await openDb();

  switch (type) {
    case "transactions":
      sql = `UPDATE servers SET transactionsid = "" WHERE serverid = ?;`;
      break;
    case "log":
      sql = `UPDATE servers SET logid = "" WHERE serverid = ?;`;
      break;
    case "alerts":
      sql = `UPDATE servers SET alertsid = "" WHERE serverid = ?;`;
      break;
  }
  db.run(sql, [interaction.guildId]).then(() => {
    interaction.editReply({
      embeds: [
        {
          color: SUCCESS_COLOR,
          description: `The ${type} channel has been cleared successfully.`,
        },
      ],
    });
  });
}
