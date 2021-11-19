const { MOOLAH_COLOR } = require("../constants.js");
const { openDb } = require("./databaseHandler.js");

let db;

module.exports = {
  updateLog,
  getLogEmbeds,
  getLogDict,
};

async function updateLog(server, newchannel = "") {
  db = await openDb();
  if (newchannel !== "") {
    c = await server.channels.cache.get(newchannel);
    c.send({ embeds: await getLogEmbeds(server) }).then((m) => {
      sql = `UPDATE servers SET logembed = ? WHERE serverid = ?;`;
      db.run(sql, [m.id, server.id]);
    });
  } else {
    sql = `SELECT logid, logembed FROM servers WHERE serverid = ?`;
    data = await db.get(sql, [server.id]);
    if (data.logid != "") {
      c = server.channels.cache.get(data.logid);
      c.messages
        .fetch(data.logembed)
        .then((oldEmbed) => {
          (async function () {
            if (!oldEmbed) {
              // in case something breaks in sending the original embed somehow
              let newEmbeds = await getLogEmbeds(server);
              c.send({ embeds: newEmbeds }).then((m) => {
                sql = `UPDATE servers SET logembed = ? WHERE serverid = ?;`;
                db.run(sql, [m.id, server.id]);
              });
            } else {
              let newEmbeds = await getLogEmbeds(server);
              oldEmbed.edit({ embeds: newEmbeds });
            }
          })();
        })
        .catch(console.error);
    }
  }
}

async function getLogEmbeds(server) {
  db = await openDb();
  embeds = [];
  return new Promise((resolve, reject) => {
    var log = {};
    // populate the log dictionary with users
    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
    db.all(sql, [server.id]).then((users) => {
      if (users.length <= 1) {
        resolve(`No transactions available.`);
      }
      var description = ``;
      users.forEach((user) => {
        description += `<@!${user.userid}>: ${user.emoji}\n`;
      });

      var titleEmbed = {};
      titleEmbed.title = "Money log";
      titleEmbed.description = description;
      titleEmbed.color = MOOLAH_COLOR;
      embeds.push(titleEmbed);

      getLogDict(users, server.id).then((log) => {
        let numUsers = users.length;
        let usersPerEmbed = Math.floor(
          4096 / (21 + 6 + (14 + 54) * (numUsers - 1))
        );
        let counter = 0;
        var value = "";

        for (user in log) {
          value += `<@!${user}> owes:\n`;

          for (key in log[user]) {
            value += `$${log[user][key].value.toFixed(2)} to ${
              log[user][key].emoji
            } | `;
          }
          value = value.slice(0, -2) + `\n\n`;

          if (counter == usersPerEmbed - 1) {
            var subEmbed = {};
            subEmbed.description = value;
            subEmbed.color = MOOLAH_COLOR;
            embeds.push(subEmbed);
            counter = 0;
            value = "";
          } else {
            counter += 1;
          }
        }
        if (counter != 0) {
          subEmbed = {};
          subEmbed.description = value;
          subEmbed.color = MOOLAH_COLOR;
          embeds.push(subEmbed);
        }

        resolve(embeds);
      });
    });
  });
}

async function getLogDict(users, serverid) {
  db = await openDb();
  return new Promise((resolve, reject) => {
    log = {};
    users.forEach((user) => {
      log[user.userid] = {};
      users.forEach((otherUser) => {
        if (otherUser.userid != user.userid) {
          log[user.userid][otherUser.userid] = {
            value: 0,
            emoji: otherUser.emoji,
          };
        }
      });
    });
    // get all transactions and handle them
    sql = `SELECT
              owner,
              recipient,
              value
          FROM
              transactions as t 
              INNER JOIN 
              transactionhands as th
              ON t.transactionid = th.transactionid
          WHERE
              th.owner != th.recipient
              AND t.serverid = ?`;
    db.all(sql, [serverid]).then((transactions) => {
      transactions.forEach((t) => {
        if (t.recipient in log) {
          if (t.owner in log[t.recipient]) {
            if (t.value < 0) {
              let leftover = 0;
              log[t.recipient][t.owner].value += t.value;
              leftover = -log[t.recipient][t.owner].value;
              if (leftover > 0) {
                log[t.owner][t.recipient].value += leftover;
                log[t.recipient][t.owner].value = 0;
              }
            } else {
              let leftover = 0;
              log[t.owner][t.recipient].value -= t.value;
              leftover = -log[t.owner][t.recipient].value;
              if (leftover > 0) {
                log[t.recipient][t.owner].value += leftover;
                log[t.owner][t.recipient].value = 0;
              }
            }
          }
        }
      });
      resolve(log);
    });
  });
}