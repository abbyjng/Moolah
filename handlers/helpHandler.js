const { MAX_CATEGORIES, MAX_USERS } = require("../constants");

const start = `There are 2 ways to use Moolah: 1) for splitting group finances and 2) to log your personal transactions.

To get started with **1) splitting group finances**, add Moolah to a server with your friends and use \`/user set\` with each person you will want to split finances with, including yourself. To keep things tidy, you can designate Moolah to certain channels using \`/channel set\`. Once that's all set, just use the primary commands (\`/bought\`, \`/paid\`, and \`/owe\`) to get splitting!

To get started with **2) logging your personal transactions**, go to your DMs with Moolah and use \`/setuppersonal\`. Then add all your most common spending categories with \`/category set\`, like groceries, dining out, or clothing. Afraid you'll forget to log your transactions? Set up daily reminders with \`/setreminder\`. You can also choose whether or not you want server transactions involving you to be included in your personal transactions by using \`/toggleshared\` (defaults to ON).

**Have any other questions?** Check out all the \`/help\` messages first, and if you are still confused, join the Moolah Community server to ask for help: https://discord.com/invite/pqHs6fMWFa`;

const descList = `- All of these commands are slash commands; utilize the autofill and input regulation to avoid misinputs.
- Inputs within {} are literals - type the option which fits your need exactly.
- Inputs within [] are variables describing what you need to submit.
- Inputs which are italicized are optional.
- **The bracket characters are not included in any command.**`;

const setupList = `**__Global commands__**
/help start
/help list
/help money servers
/help money dms
/help setup

**__Server commands__**
/user set [@user] [emoji]
/user remove [@user]
/user delete [@user]
/user list
/channel set {transactions | log | alerts} [#channel]
/channel unset {transactions | log | alerts}
/channel list

**__DM commands__**
/setuppersonal
/setreminders [time]
/export month [month] [year]
/export year [year]
/toggleshared

For more information on these commands, use \`/help setup\`.`;

const moneyList = `**__Global commands__**
/bought [money value] *[description]*
/log
/history
/delete last
/delete [number of transaction to delete]
/cleartransactions

**__Server commands__**
/paid all [user being paid]
/paid value: [money value] *[@user being paid]*
/owe [money value] *[@user owed to]* *[description]*

**__DM commands__**
/category create [name]
/category delete [name]
/category edit [old name] [new name]
/category list

For more information on these commands, use \`/help money server\` or \`/help money dms\`.`;

const setupDetails = [
  {
    name: `---------------------------------`,
    value: `**》》GLOBAL COMMANDS《《\n---------------------------------**`,
  },
  {
    name: `/help list`,
    value: `Displays a full list of Moolah's commands.\n----------`,
  },
  {
    name: `/help start`,
    value: `Details how to get started using Moolah.\n----------`,
  },
  {
    name: `/help money servers`,
    value: `Displays all of Moolah's money commands with detailed descriptions of what they do and how to use them **within servers**.\n----------`,
  },
  {
    name: `/help money dms`,
    value: `Displays all of Moolah's money commands with detailed descriptions of what they do and how to use them **withing DMs**.\n----------`,
  },
  {
    name: `/help setup`,
    value: `Displays all of Moolah's setup commands with detailed descriptions of what they do and how to use them.\n----------`,
  },
  {
    name: `---------------------------------`,
    value: `**》》SERVER COMMANDS《《\n---------------------------------**`,
  },
  {
    name: `/user set [@user] [emoji]`,
    value: `Registers a user with the bot and assigns them to an emoji. This emoji may be custom, but must be from within the local server. The emoji must be unique to this user. If the given user has already been set, their emoji will be updated to the emoji provided. You may not set more than ${MAX_USERS} users.\n----------`,
  },
  {
    name: `/user remove [@user]`,
    value: `Removes a user from active status within the bot. This will still prevent other users from adding new transactions involving this user, but will leave the user's older transactions within the history log.\n----------`,
  },
  {
    name: `/user delete [@user]`,
    value: `Deletes a user from the database. This will erase the user and all of their transactions from the database entirely.\n----------`,
  },
  {
    name: `/user list`,
    value: `Displays a list of all active users.\n----------`,
  },
  {
    name: `/channel set {transactions | log | alerts} [#channel]`,
    value: `Assigns a channel to be dedicated to a topic. \n**Transactions channel:** All commands listed under \`/help money servers\` can only be used in this channel. \n**Log channel:** A log embed will be sent to this channel. This embed will update with every new transaction or update to users. It is recommended that this channel be set to read-only so that the log may always be easily accessible. \n**Alerts channel:** All warnings about missing users or channels will be sent to this channel. By default, they will be sent instead to the first channel accessible to the bot.\n----------`,
  },
  {
    name: `/channel unset {transactions | log | alerts}`,
    value: `Clears the assignment of this channel type. If a channel was previously set to this topic, it will be removed. Removal of a log channel will not remove the log embed, but it will cause the message to no longer update.\n----------`,
  },
  {
    name: `/channel list`,
    value: `Displays a list of the channel topic assignments.\n----------`,
  },
  {
    name: `----------------------------`,
    value: `**》》DM COMMANDS《《\n----------------------------**`,
  },
  {
    name: `/setuppersonal`,
    value: `The first step to being able to use Moolah for personal transaction tracking. Sets up Moolah so it's ready to log your personal transaction details. A new log will be created and pinned within your DMs.\n----------`,
  },
  {
    name: `/setreminders`,
    value: `Sets up daily reminders for Moolah to send in your DMs to remind you to log your transactions for the day. All times are in UTC/GMT. Defaults to OFF.\n----------`,
  },
  {
    name: `/export month [month] [year]`,
    value: `Exports your transactions from a specific month as a CSV file. Includes all details for personal transactions logged in that month as well as the total spent for each category within that month.\n----------`,
  },
  {
    name: `/export year [year]`,
    value: `Same as \`/export month\`, but for an entire year's worth of logs.\n----------`,
  },
  {
    name: `/toggleshared`,
    value: `Toggles whether or not transactions from servers that you use Moolah in will be included in your personal transactions. Defaults to TRUE.`,
  },
];

const moneyServersDetails = [
  {
    name: `/bought [money value] *[description]*`,
    value: `Logs a transaction with the money value given. Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which users their purchase was for. The optional description appears only in the \`/history\` command as a log of what the purchase was for.\n----------`,
  },
  {
    name: `/paid all [@user being paid]`,
    value: `Logs a payment. All dues from the user to the recipient will be paid. User must tag the recipient.\n----------`,
  },
  {
    name: `/paid value [money value] *[@user being paid]*`,
    value: `Logs a payment. User must include a value of how much they have paid. User may tag the other person in their command to expediate the process. Otherwise, Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which user their payment was to.\n----------`,
  },
  {
    name: `/owe [money value] *[@user owed to]*`,
    value: `Logs that the user owes the value given in the money input. User may tag the other person in their command to expediate the process. Otherwise, Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which user their debt was to.\n----------`,
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
    name: `/delete last`,
    value: `Removes the most recent transaction or payment. This will permanently remove the transaction. A confirmation message will send before this action can be completed.\n----------`,
  },
  {
    name: `/delete number [number of transaction to delete]`,
    value: `Removes the transaction or payment associated with the number input. This number can be found by using \`/history\`. This will permanently remove the transaction. A confirmation message will send before this action can be completed.\n----------`,
  },
  {
    name: `/cleartransactions`,
    value: `Deletes all transactions in the server. A confirmation message will send before this action can be completed.`,
  },
];

const moneyDmsDetails = [
  {
    name: `/bought [money value] *[description]* *[category]*`,
    value: `Logs a transaction with the money value given. Moolah will follow up this command with an embed listing all the information from the command and emoji reactions to allow the user to pick which users their purchase was for. The optional description appears only in the \`/history\` command as a log of what the purchase was for. If provided, the category must already exist. Categories can be created with \`/category create\`. Transactions that do not list a cateogory will go to "miscellaneous".\n----------`,
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
    name: `/delete last`,
    value: `Removes the most recent transaction. This will permanently remove the transaction. A confirmation message will send before this action can be completed.\n----------`,
  },
  {
    name: `/delete number [number of transaction to delete]`,
    value: `Removes the transaction associated with the number input. This number can be found by using \`/history\`. This will permanently remove the transaction. A confirmation message will send before this action can be completed.\n----------`,
  },
  {
    name: `/cleartransactions`,
    value: `Deletes all transactions in the server. A confirmation message will send before this action can be completed.\n----------`,
  },
  {
    name: `/category create [name]`,
    value: `Creates a category which you will then be able to categorize transactions within in order to compartamentalize your transactions. You may not have more than ${MAX_CATEGORIES} categories. A "miscellaneous" category exists by default.\n----------`,
  },
  {
    name: `/category delete [name]`,
    value: `Deletes a category. All transactions within that category will move to "miscellanous".\n----------`,
  },
  {
    name: `/category edit [old name] [new name]`,
    value: `Edits a category name. The new name must not exist as a category already.\n----------`,
  },
  {
    name: `/category list`,
    value: `Lists out all existing categories.`,
  },
];

module.exports = {
  start,
  descList,
  setupList,
  moneyList,
  setupDetails,
  moneyServersDetails,
  moneyDmsDetails,
};
