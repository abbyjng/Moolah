const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR, ERROR_COLOR } = require("../constants.js");
const { checkValidUser } = require("../handlers/permissionHandler.js");
const { openDb } = require("../handlers/databaseHandler.js");
const {
  monthStartAndEnd,
  yearStartAndEnd,
} = require("../handlers/logHandler.js");
const fs = require("fs");

const numberToMonth = [
  "no 0th month",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("[DMs only] Export transactions as a CSV file.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("month")
        .setDescription("Export a CSV file for a specific month.")
        .addIntegerOption((option) =>
          option
            .setName("month")
            .setDescription("The month of transactions to export")
            .setRequired(true)
            .addChoices(
              { name: "January", value: 1 },
              { name: "February", value: 2 },
              { name: "March", value: 3 },
              { name: "April", value: 4 },
              { name: "May", value: 5 },
              { name: "June", value: 6 },
              { name: "July", value: 7 },
              { name: "August", value: 8 },
              { name: "September", value: 9 },
              { name: "October", value: 10 },
              { name: "November", value: 11 },
              { name: "December", value: 12 }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName("year")
            .setDescription("The year of transactions to export")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("year")
        .setDescription("Export a CSV file for a specific year.")
        .addIntegerOption((option) =>
          option
            .setName("year")
            .setDescription("The year of transactions to export")
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    let db = await openDb();
    let month = null;
    if (interaction.options.getSubcommand() === "month") {
      month = interaction.options.getInteger("month");
    }
    const year = interaction.options.getInteger("year");
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
        let filename = `${interaction.user.username}_${
          month ? numberToMonth[month] : ""
        }${year}.csv`;

        // start the file with the month and year as the header and the column labels
        fs.writeFile(
          filename,
          `${
            month ? numberToMonth[month] + "," + year : year
          }\n\nTime submitted,Category,Value,Description\n`,
          function (err) {
            if (err) throw err;
          }
        );

        // get all transactions from that month or year and append them to the file
        sql = `SELECT name FROM categories WHERE userid = ?`;
        let categories = await db.all(sql, [userid]);

        let log = {};

        categories.forEach((category) => {
          log[category.name] = 0;
        });

        let startAndEnd = [];
        if (interaction.options.getSubcommand() === "month") {
          startAndEnd = monthStartAndEnd(month, year);
        } else {
          startAndEnd = yearStartAndEnd(year);
        }
        sql = `SELECT value, category, created, description FROM transactions WHERE serverid = ? AND created >= ? AND created < ?`;
        db.all(sql, [userid, ...startAndEnd]).then((transactions) => {
          if (transactions.length != 0) {
            let writtenTransactions = 0;
            transactions.forEach((t) => {
              log[t.category] += t.value;

              fs.appendFile(
                filename,
                `${t.created},${t.category},${t.value.toFixed(2)},${
                  t.description
                }\n`,
                function (err) {
                  if (err) throw err;
                  writtenTransactions++;
                  if (writtenTransactions === transactions.length) {
                    // add space after transactions
                    fs.appendFile(filename, `\n`, function (err) {
                      if (err) throw err;
                    });

                    // add category summaries to the end
                    let writtenCategories = 0;
                    categories.forEach((category) => {
                      fs.appendFile(
                        filename,
                        `${category.name},${log[category.name].toFixed(2)}\n`,
                        function (err) {
                          if (err) throw err;
                          writtenCategories++;
                          if (writtenCategories === categories.length) {
                            // send file
                            interaction
                              .reply({
                                embeds: [
                                  {
                                    color: MOOLAH_COLOR,
                                    description: `CSV file generated for ${
                                      month
                                        ? numberToMonth[month] + ", " + year
                                        : year
                                    }.`,
                                  },
                                ],
                                files: [`./${filename}`],
                              })
                              .then(() => {
                                fs.unlink(filename, function (err) {
                                  if (err) throw err;
                                });
                              });
                          }
                        }
                      );
                    });
                  }
                }
              );
            });
          } else {
            interaction
              .reply({
                embeds: [
                  {
                    color: ERROR_COLOR,
                    description: `No transactions found for ${
                      month ? numberToMonth[month] + ", " + year : year
                    }.`,
                  },
                ],
              })
              .then(() => {
                fs.unlink(filename, function (err) {
                  if (err) throw err;
                });
              });
          }
        });
      }
    }
  },
};
