const { SlashCommandBuilder } = require("@discordjs/builders");
const { ERROR_COLOR, SUCCESS_COLOR } = require("../constants");
const { openDb } = require("../handlers/databaseHandler");
const { getDMLogEmbed } = require("../handlers/logHandler");
const { MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuppersonal")
    .setDescription(
      "[DMs only] Sets up your user for personal transaction tracking."
    ),
  async execute(interaction) {
    let db = await openDb();
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
      sql = `SELECT userid FROM dms WHERE userid = ?`;
      existingDM = await db.get(sql, [userid]);
      if (!existingDM) {
        const now = new Date();
        interaction.user
          .send({
            embeds: [
              await getDMLogEmbed(
                userid,
                now.getMonth() + 1,
                now.getFullYear()
              ),
            ],
            components: [startingButtons()],
          })
          .then((m) => {
            m.pin();
            // add dm to the database
            sql = `INSERT INTO dms (userid, logembed) 
                        VALUES (?, ?);`;
            db.run(sql, [userid, m.id]);

            sql = `INSERT INTO categories (userid, name)
                        VALUES (?, "miscellaneous")`;
            db.run(sql, [userid]);

            interaction.reply({
              embeds: [
                {
                  description: `This DM has successfully been set up for personal transaction tracking.`,
                  color: SUCCESS_COLOR,
                },
              ],
            });
          });
      } else {
        interaction.reply({
          embeds: [
            {
              description: `This DM was already set up for personal transaction tracking. use \`/personalhelp\` for help on how to get started.`,
              color: ERROR_COLOR,
            },
          ],
        });
      }
    }
  },
};

const startingButtons = () => {
  return new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("full_back")
      .setEmoji("⏮️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("back")
      .setEmoji("◀️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("front")
      .setEmoji("▶️")
      .setStyle("SECONDARY")
      .setDisabled(true),
    new MessageButton()
      .setCustomId("full_front")
      .setEmoji("⏭️")
      .setStyle("SECONDARY")
      .setDisabled(true)
  );
};
