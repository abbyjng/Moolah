const { MOOLAH_COLOR } = require("../constants.js");
const { openDb } = require("./databaseHandler.js");
const { MessageActionRow, MessageButton } = require("discord.js");

let db;

module.exports = {
  updateLog,
  getLogEmbeds,
  getLogDict,
  getDMLogEmbed,
  updateDMLog,
  getButtonMonths,
  getDMLogButtons,
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
    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
    db.all(sql, [server.id]).then((users) => {
      if (users.length <= 1) {
        resolve([{ color: MOOLAH_COLOR, title: `No transactions available.` }]);
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

async function getDMLogEmbed(userid, month, year) {
  db = await openDb();
  embeds = [];
  return new Promise((resolve, reject) => {
    sql = `SELECT name FROM categories WHERE userid = ?`;
    db.all(sql, [userid]).then((categories) => {
      const date = new Date(year, month - 1, 1);
      const title = date.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      getDMLogDict(userid, categories, month, year).then((log) => {
        if (!log) {
          resolve({
            color: MOOLAH_COLOR,
            title: title,
            description: `No transactions available.`,
          });
        }

        let descString = "";
        for (category in log) {
          descString += `**${category}:** $${log[category].toFixed(2)}\n`;
        }

        var embed = {
          title: title,
          description: descString,
          color: MOOLAH_COLOR,
          footer: {
            text: "Use the buttons to view other months.",
          },
        };
        resolve(embed);
      });
    });
  });
}

async function getDMLogDict(userid, categories, month, year) {
  db = await openDb();
  return new Promise((resolve, reject) => {
    log = {};

    categories.forEach((category) => {
      log[category.name] = 0;
    });

    sql = `SELECT value, category, created FROM transactions WHERE serverid = ? AND created >= ? AND created < ?`;
    db.all(sql, [userid, ...monthStartAndEnd(month, year)]).then(
      (transactions) => {
        if (transactions.length === 0) {
          resolve(null);
        }

        transactions.forEach((t) => {
          log[t.category] += t.value;
        });

        resolve(log);
      }
    );
  });
}

async function updateDMLog(user, channel) {
  db = await openDb();
  sql = `SELECT logembed FROM dms WHERE userid = ?`;
  data = await db.get(sql, [user.id]);

  channel.messages
    .fetch(data.logembed)
    .then((oldEmbed) => {
      (async function () {
        const now = new Date();
        month = now.getMonth() + 1;
        year = now.getFullYear();
        const newEmbed = await getDMLogEmbed(user.id, month, year);
        const b = await getButtonMonths(user.id, month, year);
        if (!oldEmbed) {
          // in case something breaks in sending the original embed somehow
          user
            .send({
              embeds: [newEmbed],
              components: [
                await getDMLogButtons(
                  b.firstMonth,
                  b.prevMonth,
                  b.nextMonth,
                  b.latestMonth
                ),
              ],
            })
            .then((m) => {
              sql = `UPDATE dms SET logembed = ? WHERE userid = ?;`;
              db.run(sql, [m.id, user.id]);
            });
        } else {
          oldEmbed.edit({
            embeds: [newEmbed],
            components: [
              await getDMLogButtons(
                b.firstMonth,
                b.prevMonth,
                b.nextMonth,
                b.latestMonth
              ),
            ],
          });
        }
      })();
    })
    .catch(console.error);
}

async function getButtonMonths(userid, month, year) {
  db = await openDb();
  return new Promise((resolve, reject) => {
    sql = `SELECT created FROM transactions WHERE serverid = ? ORDER BY created ASC LIMIT 1`;
    db.get(sql, [userid]).then((oldestTransaction) => {
      // no transactions exist
      if (oldestTransaction === undefined) {
        resolve({
          firstMonth: "",
          prevMonth: "",
          nextMonth: "",
          latestMonth: "",
        });
        return;
      }
      const now = new Date();
      const selectedMonth = `${month} ${year}`;
      let firstMonth = formatSQLDate(oldestTransaction.created);
      let prevMonth = month === 1 ? `12 ${year - 1}` : `${month - 1} ${year}`;
      let nextMonth = month === 12 ? `1 ${year + 1}` : `${month + 1} ${year}`;
      let currMonth = `${now.getMonth() + 1} ${now.getFullYear()}`;

      if (firstMonth === selectedMonth) {
        firstMonth = "";
        prevMonth = "";
      }

      if (currMonth === selectedMonth) {
        nextMonth = "";
        currMonth = "";
      }

      resolve({
        firstMonth:
          firstMonth === "" ? firstMonth : `DMLOG ${firstMonth} full_back`,
        prevMonth: prevMonth === "" ? prevMonth : `DMLOG ${prevMonth} back`,
        nextMonth: nextMonth === "" ? nextMonth : `DMLOG ${nextMonth} front`,
        latestMonth:
          currMonth === "" ? currMonth : `DMLOG ${currMonth} full_front`,
      });
    });
  });
}

async function getDMLogButtons(firstMonth, prevMonth, nextMonth, latestMonth) {
  return new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId(firstMonth !== "" ? firstMonth : "full_back")
      .setEmoji("⏮️")
      .setStyle("SECONDARY")
      .setDisabled(firstMonth === ""),
    new MessageButton()
      .setCustomId(prevMonth !== "" ? prevMonth : "back")
      .setEmoji("◀️")
      .setStyle("SECONDARY")
      .setDisabled(prevMonth === ""),
    new MessageButton()
      .setCustomId(nextMonth !== "" ? nextMonth : "front")
      .setEmoji("▶️")
      .setStyle("SECONDARY")
      .setDisabled(nextMonth === ""),
    new MessageButton()
      .setCustomId(latestMonth !== "" ? latestMonth : "full_front")
      .setEmoji("⏭️")
      .setStyle("SECONDARY")
      .setDisabled(latestMonth === "")
  );
}

function monthStartAndEnd(month, year) {
  const start = `${year}-${month.toString().padStart(2, "0")}-01`;
  if (month === 12) {
    month = 1;
    year += 1;
  } else {
    month += 1;
  }
  const end = `${year}-${month.toString().padStart(2, "0")}-01`;
  return [start, end];
}

function formatSQLDate(date) {
  const splitDate = date.split("-", 2);
  return `${parseInt(splitDate[1])} ${splitDate[0]}`;
}
