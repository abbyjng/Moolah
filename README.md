# Moolah

### A simple Discord bot designed to keep group finances simple and maintainable.

Moolah can be used for any group from a short vacation group of 15 to a long term roommate relationship of 3. This easy-to-use bot simplifies what would normally be dozens of Venmo charges into just a few, or as many as you'd like. Moolah reduces clutter and shows you only what you need to know while also maintaining all the details you might need.

### [Add Moolah to your server!](https://discord.com/api/oauth2/authorize?client_id=839639502767259669&permissions=11328&scope=bot%20applications.commands)

Join the [Discord server](https://discord.gg/78EPUxMxt2)!

## Interested in contributing?

Follow the below steps to get started. Be sure to read through the [contributing guidelines](CONTRIBUTING.md) before opening a new PR.

**Download node**

Follow [this link](https://nodejs.org/en/) to install node on your machine. Moolah runs on JavaScript and should be run using node.

**Cloning the code**

The next step is to fork this repository. It is expected that you submit all pull requests from your own forked version of the code. Clone the code from your own fork to your machine.

Run `npm install` to install all necessary packages to run Moolah.

**Create a test bot**

Directions on creating a new app and getting the auth token can be found [here](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token). Follow this guide to add the bot to your testing server and get your auth token.

**Running the bot locally**

In order to add your token to the bot, create a new file `auth.json` in the base directory of Moolah. Inside, write this code:

```
{
  "token": "[YOUR_TOKEN_HERE]"
}
```

After you've pasted your token in the auth.json file, run `node Moolah.js` from your terminal in the base directory. The console should log `Logged in as [your bot's name]!` after a second or two.

Your code is now set up and ready to be edited!

**Submit your changes**

Firstly, ensure your code follows all expectations as per the [contributing guidelines](CONTRIBUTING.md).

Once you are confident that your edits are complete, create a new pull request with a descriptive title and description, and link all relevant issues or screenshots. If possible, include a short summary of tests you ran for your changes.

Once your pull request is submitted, wait for approval, upon which your changes will be merged into the codebase.

**Thank you for contributing!**

This project is licensed under the terms of the MIT license.

_Designed and developed by @beexng#2380_
