const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR, ERROR_COLOR } = require("../constants.js");
const { checkValidUser } = require("../handlers/permissionHandler.js");
const { openDb } = require("../handlers/databaseHandler.js");
const { updateReminder } = require("../handlers/reminderHandler.js");

const indexToTime = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setreminders")
    .setDescription(
      "[DMs only] Sets up daily reminders to submit your transactions."
    )
    .addIntegerOption((option) =>
      option
        .setName("time")
        .setDescription(
          "The time of day you will receive your daily reminders. All times are in UTC / GMT."
        )
        .setRequired(true)
        .addChoices(
          { name: "12am (Midnight)", value: 0 },
          { name: "3am", value: 1 },
          { name: "6am", value: 2 },
          { name: "9am", value: 3 },
          { name: "12pm (Noon)", value: 4 },
          { name: "3pm", value: 5 },
          { name: "6pm", value: 6 },
          { name: "9pm", value: 7 },
          { name: "Off", value: 8 }
        )
    ),
  async execute(interaction) {
    let db = await openDb();
    const time = interaction.options.getInteger("time");
    const userid = interaction.user.id;

    if (interaction.guild !== null) {
      interaction.reply({
        embeds: [
          {
            description: `This command is for DMs only.`,
            color: ERROR_COLOR,
          },
        ],
      });
    } else {
      let validUser = await checkValidUser(interaction);
      if (validUser) {
        let oldTime = await db.get(
          `SELECT reminder FROM dms WHERE userid = ?`,
          [userid]
        );
        db.run(`UPDATE dms SET reminder = ? WHERE userid = ?`, [
          time,
          userid,
        ]).then(() => {
          if (time != 8) {
            interaction.reply({
              embeds: [
                {
                  color: MOOLAH_COLOR,
                  description: `Set reminders to send at **${indexToTime[time]} GMT** every day.`,
                },
              ],
            });
            updateReminder(time);
          } else {
            interaction.reply({
              embeds: [
                {
                  color: MOOLAH_COLOR,
                  description: "Turned reminders off.",
                },
              ],
            });
          }
          updateReminder(oldTime.reminder);
        });
      }
    }
  },
};
