const { openDb } = require("./databaseHandler.js");
const cron = require("cron");

let db;

let cronJobs = [];
let client;

module.exports = {
  startReminders,
  updateReminder,
};

async function startReminders(c) {
  client = c;
  db = await openDb();

  let userSchedules = [[], [], [], [], [], [], [], []];

  sql = `SELECT userid, reminder FROM dms`;
  let users = await db.all(sql, []);

  users.forEach((user) => {
    if (user.reminder != 8) {
      userSchedules[user.reminder].push(user.userid);
    }
  });

  for (let i = 0; i < 8; i++) {
    let newJob = new cron.CronJob(`00 00 ${i * 3} * * *`, () => {
      userSchedules[i].forEach((userid) => {
        client.users.fetch(userid).then((user) => {
          user.send(
            "⏰ Have you submitted all of your transactions for the day?"
          );
        });
      });
    });
    cronJobs.push(newJob);
    newJob.start();
  }
}

async function updateReminder(index) {
  if (index != 8) {
    cronJobs[index].stop();
  }

  db = await openDb();

  let userids = [];

  sql = `SELECT userid, reminder FROM dms`;
  let users = await db.all(sql, []);

  users.forEach((user) => {
    if (user.reminder == index) {
      userids.push(user.userid);
    }
  });

  let newJob = new cron.CronJob(`00 00 ${index * 3} * * *`, () => {
    userids.forEach((userid) => {
      client.users.fetch(userid).then((user) => {
        user.send(
          "⏰ Have you submitted all of your transactions for the day?"
        );
      });
    });
  });
  cronJobs[index] = newJob;
  newJob.start();
}
