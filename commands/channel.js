const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  listChannel,
  setChannel,
  unsetChannel,
} = require("../handlers/channelHandler.js");
const { ERROR_COLOR } = require("../constants.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel")
    .setDescription("Channel-related commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Displays a list of the assigned channel types.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Assigns a channel to a certain role.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of channel being assigned")
            .setRequired(true)
            .addChoices(
              { name: "transactions", value: "transactions" },
              { name: "log", value: "log" },
              { name: "alerts", value: "alerts" }
            )
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel being assigned")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unset")
        .setDescription("Unsets the assignment of a channel type.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of channel being cleared")
            .setRequired(true)
            .addChoices(
              { name: "transactions", value: "transactions" },
              { name: "log", value: "log" },
              { name: "alerts", value: "alerts" }
            )
        )
    ),
  async execute(interaction) {
    await interaction.deferReply();

    if (interaction.guild === null) {
      interaction.reply({
        embeds: [
          {
            description: `This command is for servers only.`,
            color: ERROR_COLOR,
          },
        ],
      });
      return;
    }

    let type;
    let channel;
    switch (interaction.options.getSubcommand()) {
      case "list":
        listChannel(interaction);
        break;
      case "set":
        type = interaction.options.getString("type");
        channel = interaction.options.getChannel("channel");
        setChannel(interaction, type, channel);
        break;
      case "unset":
        type = interaction.options.getString("type");
        unsetChannel(interaction, type);
        break;
    }
  },
};
