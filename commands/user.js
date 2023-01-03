const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  listUser,
  setUser,
  removeUser,
  deleteUser,
} = require("../handlers/userHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("User-related commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription(
          "Displays a list of registered users and their corresponding emojis."
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription(
          "Adds a new user to the log database or changes their emoji if they are already active."
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to be added or changed")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji to be assigned to the user")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription(
          "Removes a user from the active userlist. Their transactions will still be visible."
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to be removed")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription(
          "Deletes a user from the database. Their transactions will also be deleted."
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to be deleted")
            .setRequired(true)
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

    let user;
    let emoji;
    switch (interaction.options.getSubcommand()) {
      case "list":
        listUser(interaction);
        break;
      case "set":
        user = interaction.options.getUser("user");
        emoji = interaction.options.getString("emoji");
        setUser(interaction, user, emoji);
        break;
      case "remove":
        user = interaction.options.getUser("user");
        removeUser(interaction, user);
        break;
      case "delete":
        user = interaction.options.getUser("user");
        deleteUser(interaction, user);
        break;
    }
  },
};
