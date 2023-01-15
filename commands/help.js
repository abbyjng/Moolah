const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR } = require("../constants");
const {
  start,
  descList,
  setupList,
  moneyList,
  setupDetails,
  moneyServersDetails,
  moneyDmsDetails,
} = require("../handlers/helpHandler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("For if you need help using Moolah.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("start")
        .setDescription(
          "Learn what Moolah does and how to get started using it!"
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription(
          "Returns a list of all of Moolah's commands without descriptions."
        )
    )
    .addSubcommandGroup((subcommand) =>
      subcommand
        .setName("money")
        .setDescription("Returns detailed lists of Moolah's money commands.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("servers")
            .setDescription(
              "Returns a detailed list of server-specific transaction commands and what they do."
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("dms")
            .setDescription(
              "Returns a detailed list of DM-specific transaction commands and what they do."
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription(
          "Displays a list of all of Moolah's commands without descriptions."
        )
    ),
  async execute(interaction) {
    switch (interaction.options.getSubcommand()) {
      case "start":
        await interaction.reply({
          embeds: [
            {
              title: `Welcome to Moolah!`,
              color: MOOLAH_COLOR,
              description: start,
            },
          ],
        });
        break;
      case "list":
        await interaction.reply({
          embeds: [
            {
              title: `My commands:`,
              color: MOOLAH_COLOR,
              description: descList,
              fields: [
                {
                  name: ":gear: Setup and logistics :wrench:",
                  value: setupList,
                },
                {
                  name: ":moneybag: Money :money_with_wings:",
                  value: moneyList,
                },
              ],
            },
          ],
        });
        break;
      case "servers":
        await interaction.reply({
          embeds: [
            {
              title: `:moneybag: My server money commands: :money_with_wings:`,
              color: MOOLAH_COLOR,
              fields: moneyServersDetails,
            },
          ],
        });
        break;
      case "dms":
        await interaction.reply({
          embeds: [
            {
              title: `:moneybag: My DM money commands: :money_with_wings:`,
              color: MOOLAH_COLOR,
              fields: moneyDmsDetails,
            },
          ],
        });
        break;
      case "setup":
        await interaction.reply({
          embeds: [
            {
              title: `:gear: My setup commands: :wrench:`,
              color: MOOLAH_COLOR,
              fields: setupDetails,
            },
          ],
        });
        break;
    }
  },
};
