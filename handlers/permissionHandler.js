const { ERROR_COLOR } = require("../constants.js");
const { openDb } = require("./databaseHandler.js");

module.exports = {
  checkValidUser,
  checkTransactionsChannel,
};

async function checkValidUser(interaction) {
  let userid = interaction.user.id;
  let serverid = interaction.guildId;
  let guild = interaction.guild;

  let db = await openDb();
  return new Promise((resolve, reject) => {
    if (guild == null) {
      // dms
      let sql = `SELECT userid FROM dms WHERE userid = ?`;
      db.get(sql, [userid]).then((val) => {
        if (val) {
          resolve(true);
        } else {
          interaction.reply({
            embeds: [
              {
                description: `Personal transaction tracking is not set up for your account yet. Run \`/setupPersonal\` to set it up or \`/personalHelp\` for more information.`,
                color: ERROR_COLOR,
              },
            ],
          });
        }
      });
    } else {
      // server
      let sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
      db.get(sql, [userid, serverid]).then((val) => {
        if (val) {
          resolve(true);
        } else {
          let sql = `SELECT userid FROM users WHERE serverid = ? AND status = 1`;
          db.get(sql, [serverid]).then((users) => {
            if (!users) {
              interaction.editReply({
                embeds: [
                  {
                    description: `No users are set. Set up users using \`/setUser [@user] [emoji]\`.`,
                    color: ERROR_COLOR,
                  },
                ],
              });
            } else {
              interaction.editReply({
                embeds: [
                  {
                    description: `This command may only be used by active users. Use /setuser to register a new user.`,
                    color: ERROR_COLOR,
                  },
                ],
              });
            }
            resolve(false);
          });
        }
      });
    }
  });
}

async function checkTransactionsChannel(channelid, serverid) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    let sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
    db.get(sql, [serverid]).then((data) => {
      if (data.transactionsid == "" || data.transactionsid == channelid) {
        resolve(null);
      } else {
        resolve(data.transactionsid);
      }
    });
  });
}
