const { SlashCommandBuilder } = require('@discordjs/builders');

let desc = `- Inputs within {} are literals - type the option which fits your need exactly.
- Inputs within [] are variables describing what you need to submit.
- Inputs which are italicized are optional.
- All commands are **not** case sensitive.
- **The bracket characters are not included in any command.**`;

let setupCmds = `/help
/setUser [@user] [emoji]
/removeUser [@user]
/userList
/setChannel {transactions | log | alerts} [#channel]
/clearChannel {transactions | log | alerts}
/channelList

For more information on these commands, use \`/setupHelp\`.`;

let moneyCmds = `/bought [money value to 2 decimals] *[description]*
/paid [money value to 2 decimals] *[emoji of person being paid]*
/log
/history
/delete {last | [number of transaction to delete]}
/clearTransactions

For more information on these commands, use \`/moneyHelp\`.`;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Displays a list of Moolah\'s commands.'),
	async execute(interaction) {
		await interaction.reply({embeds: [{
			title: `My commands:`,
			color: 0x2471a3, 
			description: desc,
			fields:[
				{
					name: ':gear: Setup and logistics :wrench:',
					value: setupCmds
				},   
				{
					name: ':moneybag: Money :money_with_wings:',
					value: moneyCmds
				},     
			]
		}]});
	},
}