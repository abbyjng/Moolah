const { SlashCommandBuilder } = require("@discordjs/builders");
const { MOOLAH_COLOR } = require("../constants");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("moneyhelp")
    .setDescription(
      "Displays a detailed list of Moolah's money commands and what they do."
    ),
  async execute(interaction) {
    await interaction.reply({
      embeds: [
        {
          title: `:moneybag: My money commands: :money_with_wings:`,
          color: MOOLAH_COLOR,
          fields: [
            {
              name: `/bought [money value] *[description]*`,
              value: `Logs a transaction with the value given in the first input. Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which users their purchase was for. The optional description appears only in the \`/history\` command as a log of what the purchase was for.\n----------`,
            },
            {
              name: `/paid {all: [@user being paid] | value: [money value] *[@user being paid]*}`,
              value: `Logs a payment. If the 'all' path is chosen, all dues from the user to the recipient will be paid. User must tag the recipient. If the 'value' path is chosen, user must include a value of how much they have paid. User may tag the other person in their command to expediate the process. Otherwise, Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which user their payment was to.\n----------`,
            },
            {
              name: `/owe [money value] *[@user owed to]*`,
              value: `Logs that the user owes the value given in the first input. User may tag the other person in their command to expediate the process. Otherwise, Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which user their debt was to.\n----------`,
            },
            {
              name: `/log`,
              value: `Displays the current log of balances between all active users. This is the same log which displays in a registered log channel.\n----------`,
            },
            {
              name: `/history`,
              value: `Displays a list of all previously logged transactions and payments. 10 transactions max will be shown on the list at a time; the user may scroll up and down the list using the arrow reactions on the message. The numbering on this list is used with the \`/delete\` command.\n----------`,
            },
            {
              name: `/delete {last | number [number of transaction to delete]}`,
              value: `Removes the transaction or payment associated with the first input. This number can be found by using \`/history\`. This will permanently remove the transaction. A confirmation message will send before this action can be completed.\n----------`,
            },
            {
              name: `/cleartransactions`,
              value: `Deletes all transactions in the server. A confirmation message will send before this action can be completed.`,
            },
          ],
        },
      ],
    });
  },
};
