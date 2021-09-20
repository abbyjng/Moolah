const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { token } = require("./auth.json");
const fs = require("fs");

const commands = [];
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

// Place your client and guild ids here
const clientId = "872670044595826698";
const guildId = "839665867461361720";

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    // LOCAL COMMANDS - use for testing within your local server. Creates slash commands instantly; no caching involved.
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    // GLOBAL COMMANDS - use if you want to set up slash commands for all guilds your bot is in. This may take up to 1 hour to register in Discord's system.
    // await rest.put(Routes.applicationCommands(clientId), {
    //   body: commands,
    // });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
