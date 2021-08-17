const Discord = require('discord.js');

const StatusEnum = Object.freeze({"WORKING":1, "GOOD":2, "CANCELLED":3, "TIMEDOUT":4})

let t = {}; // contains all current instances of transactions
let l = {}; // contains all current instances of live log embeds

function getInfoString(info, totalUsers) {
    retStr = "";

    if (info.recipients.length == 0) {
        retStr += `All (default)\n`
    } else {
        info.recipients.forEach((user) => {
            retStr += `<@!${user.userid}>, `;
        })
        retStr = retStr.slice(0, -2) + `\n`;
    }

    retStr += `Total charge: **$${parseFloat(info.value).toFixed(2)}**\n`;
    if (info.recipients.length == 0) {
        retStr += `Each charged: **$${(info.value / totalUsers).toFixed(2)}**\n`;
    } else {
        retStr += `Each charged: **$${(info.value / info.recipients.length).toFixed(2)}**\n`;
    }
    if (info.description === "") {
        retStr += `**Message:** N/A`;
    } else {
        retStr += `**Message:** ${info.description}`;
    }

    return retStr;
}

function getLogMessage(transactions, startIndex) {
    retStr = ``;
    for (var i = startIndex; i < Math.min(startIndex + 10, transactions.length); ++i) {
        if (transactions[i].description !== "defaultPaidDescription") {
            retStr += `${i + 1}) <@!${transactions[i].owner}> → `
            transactions[i].emojis.forEach((emoji) => { retStr += emoji });
            if (transactions[i].emojis.length > 1) {
                retStr += ` [$${transactions[i].value.toFixed(2)}ea] `
            } else {
                retStr += ` [$${transactions[i].value.toFixed(2)}] `
            }
            retStr += `"${transactions[i].description}" | ${getFormattedDate(transactions[i].created)}\n`
        } else {
            retStr += `${i + 1}) <@!${transactions[i].owner}> paid ${transactions[i].emojis[0]} `
            retStr += `[$${(transactions[i].value).toFixed(2)}] | ${getFormattedDate(transactions[i].created)}\n`
        }
    }
    
    return retStr;
}

function getFormattedDate(date) {
    date = new Date(date + "Z")
    d = date.getDate();
    m = date.getMonth() + 1;
    y = date.getFullYear();
    return m + '-' + (d <= 9 ? '0' + d : d) + '-' + y;
}

function confirmTransaction(channel, ownerid, recipients, value, description) {
    msg = `<@!${ownerid}> purchased **$${parseFloat(value).toFixed(2)}** for `;
    recipients.forEach((user) => {
        msg += user.emoji;
        msg += `<@!${user.userid}>, `;
    })
    msg = msg.slice(0, -2) + `\n`;
    msg += `→ charging **$${(value/recipients.length).toFixed(2)}** to each recipient\n`
    if (description === "") {
        msg += `**Message:** N/A\n`;
    } else {
        msg += `**Message:** ${description}\n`;
    }
    channel.send({embeds: [{
        title: `Transaction added!`,
        color: 0x00FF00,
        description: msg
    }]})
}

function confirmPayment(channel, ownerid, userid, emoji, value) {
    channel.send({embeds: [{
        title: `Transaction added!`,
        color: 0x00FF00,
        description: `<@!${ownerid}> paid **$${parseFloat(value).toFixed(2)}** to ${emoji}<@!${userid}>`
    }]})
}

function transactionTimedOut(channel) {
    channel.send({embeds: [{
        title: `Transaction timed out after 2 minutes.`,
        color: 0xFF0000
    }]});
    return;
}

function transactionCancelled(channel) {
    channel.send({embeds: [{
        title: `Transaction was cancelled.`,
        color: 0xFF0000
    }]});
}

function transactionInvalid(channel) {
    channel.send({embeds: [{
        title: `Invalid input. You may not submit a transaction for only yourself.`,
        color: 0xFF0000
    }]});
}

function handleLog(channel, transactions, authorid) {
    embed = new Discord.MessageEmbed()
        .setTitle(`Transaction log`)
        .setDescription(getLogMessage(transactions, Math.max(transactions.length - 10, 0)))
    channel.send({embeds: [embed]})
    .then((m) => {
        l[(m.createdAt, authorid)] = transactions.length - 10;

        if (transactions.length > 10) {
            Promise.all([
                m.react('⏬'),
                m.react('⬇️'),
                m.react('⬆️'),
                m.react('⏫')
            ]).catch(error => console.error('One of the emojis failed to react:', error))

            const filter = (reaction, user) => {
                return ['⏬', '⬇️', '⬆️', '⏫'].includes(reaction.emoji.name) && user.id !== m.author.id;
            };
            
            // collector lasts for 2 minutes
            const collector = m.createReactionCollector({filter, time: 300000, dispose: true});

            function handleReaction(reaction) {
                if (reaction.emoji.name === '⏬') {
                    // go to the bottom of the list
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, transactions.length - 10))
                    m.edit({embeds: [newEmbed]});
                    l[(m.createdAt, authorid)] = transactions.length - 10;
                } else if (reaction.emoji.name === '⬇️') {
                    // go 10 down
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, Math.min(l[(m.createdAt, authorid)] + 10, transactions.length - 10)))
                    m.edit({embeds: [newEmbed]});
                    l[(m.createdAt, authorid)] = Math.min(l[(m.createdAt, authorid)] + 10, transactions.length - 10)
                } else if (reaction.emoji.name === '⬆️') {
                    // go 10 up
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, Math.max(l[(m.createdAt, authorid)] - 10, 0)))
                    m.edit({embeds: [newEmbed]});
                    l[(m.createdAt, authorid)] = Math.max(l[(m.createdAt, authorid)] - 10, 0);
                } else if (reaction.emoji.name === '⏫') {
                    // go to the top of the list
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, 0))
                    m.edit({embeds: [newEmbed]});
                    l[(m.createdAt, authorid)] = 0;
                }
            }

            collector.on('collect', (reaction, user) => {
                handleReaction(reaction);
            });

            collector.on('remove', (reaction, user) => {
                handleReaction(reaction)
            });

            collector.on('end', collected => {
                newEmbed = new Discord.MessageEmbed()
                    .setTitle(`Transaction log -- Inactive`)
                    .setDescription(getLogMessage(transactions, l[(m.createdAt, authorid)]))
                m.edit({embeds: [newEmbed]});
                delete l[(m.createdAt, authorid)];
            });
        }
    })
}

function confirmed(channel, message) {
    channel.send({embeds: [{
        description: message,
        color: 0x00FF00,
    }]})
}

function cancelled(channel, message) {
    channel.send({embeds: [{
        description: message,
        color: 0xFF0000
    }]});
}

function handleNoTransactions(channel) {
    embed = new Discord.MessageEmbed()
        .setTitle(`Transaction log`)
        .setDescription(`No transactions found.`)
    channel.send({embeds: [embed]})
}

module.exports = {
    handleClear: async (channel, authorid) => {
        return new Promise((resolve, reject) => {
            emojis = ['❌', '✅'];
        
            embed = new Discord.MessageEmbed()
                .setDescription(`**Warning:** By confirming this action, all transactions logged in this server will be permanently deleted. Do you wish to continue?`)
                .setFooter(`React with ✅ to confirm or ❌ to cancel this action.`);
            channel.send({embeds: [embed]})
            .then((m) => {
                Promise.all([
                    m.react('✅'),
                    m.react('❌')
                ]).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector({filter, time: 120000, dispose: true});
        
                collector.on('collect', (reaction, user) => {
                    if (user.id === authorid) {
                        collector.stop();
                    }
                });
    
                collector.on('end', collected => {
                    if (collected.length === 0) {
                        resolve(-1);
                        cancelled(channel, `Action timed out - transactions have not been cleared.`);
                    } else if (collected.keys().next().value === '❌') {
                        resolve(0);
                        cancelled(channel, `Action cancelled - transactions have not been cleared.`);
                    } else if (collected.keys().next().value === '✅') {
                        resolve(1);
                        confirmed(channel, `Transactions cleared successfully.`);
                    }
                    m.delete();
                });
            })
        })
    },
    handleDelete: async (channel, authorid, transaction, recipients, number) => {
        return new Promise((resolve, reject) => {
            emojis = ['❌', '✅'];

            var descString = `**Transaction #${number}:**\n`;
            if (transaction.description !== "defaultPaidDescription") {
                descString += `<@!${recipients[0].owner}> → `
                recipients.forEach((recipient) => { descString += recipient.emoji });
                if (recipients.length > 1) {
                    descString += ` [$${transaction.value.toFixed(2)}ea] `
                } else {
                    descString += ` [$${transaction.value.toFixed(2)}] `
                }
                descString += `"${transaction.description}" | ${getFormattedDate(transaction.created)}\n`
            } else {
                descString += `<@!${recipients[0].owner}> paid ${recipients[0].emoji} `
                descString += `[$${(transaction.value).toFixed(2)}] | ${getFormattedDate(transaction.created)}\n`
            }
        
            embed = new Discord.MessageEmbed()
                .setTitle(`Delete this transaction?`)
                .setDescription(descString)
                .setFooter(`React with ✅ to confirm or ❌ to cancel this action.`);
            channel.send({embeds: [embed]})
            .then((m) => {
                Promise.all([
                    m.react('✅'),
                    m.react('❌')
                ]).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector({filter, time: 120000, dispose: true});
        
                collector.on('collect', (reaction, user) => {
                    if (user.id === authorid) {
                        collector.stop();
                    }
                });
    
                collector.on('end', collected => {
                    if (collected.length === 0) {
                        resolve(-1);
                        cancelled(channel, `Action timed out - transaction #${number} has not been deleted.`);
                    } else if (collected.keys().next().value === '❌') {
                        resolve(0);
                        cancelled(channel, `Action cancelled - transaction #${number} has not been deleted.`);
                    } else if (collected.keys().next().value === '✅') {
                        resolve(1);
                        confirmed(channel, `Transaction #${number} deleted successfully.`);
                    }
                    m.delete();
                });
            })
        })
    },
    handleLog,
    confirmPayment,
    handleNoTransactions,
    welcome: {
        title: `Hello! Thanks for adding me! I'm Moolah, a bot designed to help keep group finances simple. 🐮`,
        thumbnail: {
            url: 'https://i.ibb.co/vZyf66y/Moolah-Logo.png',
        },
        color: 0x2471a3, 
        description: "I use slash commands, so the prefix for all my commands is '/', e.g: '/help'.\nUse the command /help to see a list of all my commands.",
        footer: { text: 'Moolah created and developed by beexng#2380.' }
    }
};