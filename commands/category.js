const { SlashCommandBuilder } = require("@discordjs/builders");
const { MAX_CATEGORY } = require("../constants");
const { checkValidUser } = require("./../handlers/permissionHandler.js");
const {
  listCategory,
  createCategory,
  deleteCategory,
  editCategory,
} = require("../handlers/categoryHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("category")
    .setDescription("[DMs only] Category-related commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Displays a list of your categories.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Creates a new transaction category.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription(`The name of the category [<${MAX_CATEGORY} chars]`)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Deletes an existing category.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The category to be removed")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Renames a transaction category.")
        .addStringOption((option) =>
          option
            .setName("old")
            .setDescription(`The previous name of the category`)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("new")
            .setDescription(
              `The new name of the category [<${MAX_CATEGORY} chars]`
            )
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    await interaction.deferReply();

    if (interaction.guild !== null) {
      interaction.editReply({
        embeds: [
          {
            description: `This command is for DMs only.`,
            color: ERROR_COLOR,
          },
        ],
      });
      return;
    }

    let validUser = await checkValidUser(interaction);
    if (!validUser) {
      return;
    }

    let name;
    let old;
    switch (interaction.options.getSubcommand()) {
      case "list":
        listCategory(interaction);
        break;
      case "create":
        name = interaction.options.getString("name");
        createCategory(interaction, name);
        break;
      case "delete":
        name = interaction.options.getString("name");
        deleteCategory(interaction, name);
        break;
      case "edit":
        old = interaction.options.getString("old");
        name = interaction.options.getString("new");
        editCategory(interaction, old, name);
        break;
    }
  },
};
