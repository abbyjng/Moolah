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
    channel.send({
        embed:{
            title: `Transaction added!`,
            color: 0x00FF00,
            description: msg
        }
    })
}

function confirmPayment(channel, ownerid, userid, emoji, value) {
    channel.send({
        embed:{
            title: `Transaction added!`,
            color: 0x00FF00,
            description: `<@!${ownerid}> paid **$${parseFloat(value).toFixed(2)}** to ${emoji}<@!${userid}>`
        }
    })
}

function transactionTimedOut(channel) {
    channel.send({
        embed: {
            title: `Transaction timed out after 2 minutes.`,
            color: 0xFF0000
        }
    });
    return;
}

function transactionCancelled(channel) {
    channel.send({
        embed: {
            title: `Transaction was cancelled.`,
            color: 0xFF0000
        }
    });
}

function transactionInvalid(channel) {
    channel.send({
        embed: {
            title: `Invalid input. You may not submit a transaction for only yourself.`,
            color: 0xFF0000
        }
    });
}

function handleLog(channel, transactions, authorid) {
    embed = new Discord.MessageEmbed()
        .setTitle(`Transaction log`)
        .setDescription(getLogMessage(transactions, Math.max(transactions.length - 10, 0)))
    channel.send(embed)
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
            const collector = m.createReactionCollector(filter, { time: 300000, dispose: true});

            function handleReaction(reaction) {
                if (reaction.emoji.name === '⏬') {
                    // go to the bottom of the list
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, transactions.length - 10))
                    m.edit(newEmbed);
                    l[(m.createdAt, authorid)] = transactions.length - 10;
                } else if (reaction.emoji.name === '⬇️') {
                    // go 10 down
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, Math.min(l[(m.createdAt, authorid)] + 10, transactions.length - 10)))
                    m.edit(newEmbed);
                    l[(m.createdAt, authorid)] = Math.min(l[(m.createdAt, authorid)] + 10, transactions.length - 10)
                } else if (reaction.emoji.name === '⬆️') {
                    // go 10 up
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, Math.max(l[(m.createdAt, authorid)] - 10, 0)))
                    m.edit(newEmbed);
                    l[(m.createdAt, authorid)] = Math.max(l[(m.createdAt, authorid)] - 10, 0);
                } else if (reaction.emoji.name === '⏫') {
                    // go to the top of the list
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`Transaction log`)
                        .setDescription(getLogMessage(transactions, 0))
                    m.edit(newEmbed);
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
                delete l[(m.createdAt, authorid)];
            });
        }
    })
}

function confirmed(channel, message) {
    channel.send({
        embed:{
            description: message,
            color: 0x00FF00,
        }
    })
}

function cancelled(channel, message) {
    channel.send({
        embed: {
            description: message,
            color: 0xFF0000
        }
    });
}

function handleNoTransactions(channel) {
    embed = new Discord.MessageEmbed()
        .setTitle(`Transaction log`)
        .setDescription(`No transactions found.`)
    channel.send(embed)
}

module.exports = {
    handleTransaction: async (channel, authorid, users, strUsers, value, description) => {
        return new Promise((resolve, reject) => {
            emojis = users.map((user) => {
                if (user.emoji.charAt(0) === '<') {
                    return user.emoji.slice(2, user.emoji.indexOf(":", 2));
                } else {
                    return `${user.emoji}`;
                }
            })
            emojis.push('❌');
            emojis.push('☑️');

            info = {
                recipients: [],
                value: value,
                description: description,
                emojis: emojis,
                status: StatusEnum.WORKING
            };
        
            embed = new Discord.MessageEmbed()
                .setTitle(`New transaction...`)
                .addFields (
                    { name: `Select recipients of this transaction:`, value: strUsers },
                    { name: `Current recipients:`, value: getInfoString(info, users.length) }
                )
                .setFooter(`React with ☑️ when finished selecting recipients.\nReact with ❌ to cancel this transaction.`);
            channel.send(embed)
            .then((m) => {
                t[(m.createdAt, authorid)] = info;

                Promise.all(
                    [m.react('☑️')].concat(
                        users.map((user) => {
                            if (user.emoji.charAt(0) === '<') {
                                return m.react(user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1));
                            } else {
                                return m.react(user.emoji);
                            }
                        }), 
                        [m.react('❌')]
                    )   
                ).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return t[(m.createdAt, authorid)].emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector(filter, { time: 120000, dispose: true});
        
                collector.on('collect', (reaction, user) => {
                    if (user.id === authorid) {
                        if (reaction.emoji.name === '☑️') {
                            if (t[(m.createdAt, authorid)].recipients.length == 0) {
                                t[(m.createdAt, authorid)].recipients = users;
                            }
                            if (t[(m.createdAt, authorid)].recipients.length == 1 && t[(m.createdAt, authorid)].recipients[0].userid == authorid) {
                                t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
                                transactionInvalid(channel);
                                resolve([0]);
                                // cancelled for invalid inputs
                                collector.stop();
                            } else {
                                t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
                                confirmTransaction(channel, authorid, t[(m.createdAt, authorid)].recipients, value, description);
                                resolve(t[(m.createdAt, authorid)].recipients);
                                // confirm transaction
                                collector.stop();
                            }
                        } else if (reaction.emoji.name === '❌') {
                            t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
                            transactionCancelled(channel);
                            resolve([0]);
                            // cancelled by button
                            collector.stop();
                        } else {
                            users.forEach((u) => {
                                if (reaction.emoji.name === u.emoji || reaction.emoji.name === u.emoji.slice(2, u.emoji.indexOf(":", 2))) {
                                    t[(m.createdAt, authorid)].recipients.push(u);
                                }
                            })
                            newEmbed = new Discord.MessageEmbed()
                                .setTitle(`New transaction...`)
                                .addFields (
                                    { name: `Select recipients of this transaction:`, value: strUsers },
                                    { name: `Current recipients:`, value: getInfoString(t[(m.createdAt, authorid)], users.length) }
                                )
                                .setFooter(`React with ☑️ when finished selecting recipients.\nReact with ❌ to cancel this transaction.`);
                            m.edit(newEmbed);
                        }
                    }
                });
    
                collector.on('remove', (reaction, user) => {
                    users.forEach((u) => {
                        if (reaction.emoji.name === u.emoji || reaction.emoji.name === u.emoji.slice(2, u.emoji.indexOf(":", 2))) {
                            for (let i = 0; i < t[(m.createdAt, authorid)].recipients.length; ++i) {
                                if (t[(m.createdAt, authorid)].recipients[i].userid === u.userid) {
                                    t[(m.createdAt, authorid)].recipients.splice(i, 1);
                                }
                            }
                        }
                    })
                    newEmbed = new Discord.MessageEmbed()
                        .setTitle(`New transaction...`)
                        .addFields (
                            { name: `Select recipients of this transaction:`, value: strUsers },
                            { name: `Current recipients:`, value: getInfoString(t[(m.createdAt, authorid)], users.length) }
                        )
                        .setFooter(`React with ☑️ when finished selecting recipients.\nReact with ❌ to cancel this transaction.`);
                    m.edit(newEmbed);
                });
    
                collector.on('end', collected => {
                    if (t[(m.createdAt, authorid)].status == StatusEnum.WORKING) {
                        t[(m.createdAt, authorid)].status = StatusEnum.TIMEDOUT;
                        transactionTimedOut(channel);
                        resolve([-1]);
                        // time ran out
                    }
                    delete t[(m.createdAt, authorid)];
                    m.delete();
                });
            })
        })
    },
    handlePayment: async (channel, authorid, users, strUsers, value) => {
        return new Promise((resolve, reject) => {
            emojis = users.map((user) => {
                if (user.emoji.charAt(0) === '<') {
                    return user.emoji.slice(2, user.emoji.indexOf(":", 2));
                } else {
                    return `${user.emoji}`;
                }
            })
            emojis.push('❌');

            info = {
                recipient: "",
                value: value,
                emojis: emojis,
                status: StatusEnum.WORKING
            };
        
            embed = new Discord.MessageEmbed()
                .setTitle(`New payment...`)
                .addFields (
                    { name: `Select the recipient of this payment of $${parseFloat(value).toFixed(2)}:`, value: strUsers },
                )
            channel.send(embed)
            .then((m) => {
                t[(m.createdAt, authorid)] = info;

                Promise.all(
                    users.map((user) => {
                        if (user.userid != authorid) {
                            if (user.emoji.charAt(0) === '<') {
                                return m.react(user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1));
                            } else {
                                return m.react(user.emoji);
                            }
                        }
                    }).concat([m.react('❌')])
                ).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return t[(m.createdAt, authorid)].emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector(filter, { time: 120000, dispose: true});
        
                collector.on('collect', (reaction, user) => {
                    if (user.id === authorid) {
                        if (reaction.emoji.name === '❌') {
                            t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
                            transactionCancelled(channel);
                            resolve(0);
                            // cancelled by button
                            collector.stop();
                        } else {
                            users.forEach((u) => {
                                if (reaction.emoji.name === u.emoji || reaction.emoji.name === u.emoji.slice(2, u.emoji.indexOf(":", 2))) {
                                    t[(m.createdAt, authorid)].recipient = u;
                                    t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
                                    confirmPayment(channel, authorid, u.userid, u.emoji, value);
                                    resolve(u);
                                    collector.stop();
                                }
                            })
                        }
                    }
                });
    
                collector.on('end', collected => {
                    if (t[(m.createdAt, authorid)].status == StatusEnum.WORKING) {
                        t[(m.createdAt, authorid)].status = StatusEnum.TIMEDOUT;
                        transactionTimedOut(channel);
                        resolve(-1);
                        // time ran out
                    }
                    delete t[(m.createdAt, authorid)];
                    m.delete();
                });
            })
        })
    },
    handleClear: async (channel, authorid) => {
        return new Promise((resolve, reject) => {
            emojis = ['❌', '☑️'];
        
            embed = new Discord.MessageEmbed()
                .setDescription(`**Warning:** By confirming this action, all transactions logged in this server will be permanently deleted. Do you wish to continue?`)
                .setFooter(`React with ☑️ to confirm or ❌ to cancel this action.`);
            channel.send(embed)
            .then((m) => {
                Promise.all([
                    m.react('☑️'),
                    m.react('❌')
                ]).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector(filter, { time: 120000, dispose: true});
        
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
                    } else if (collected.keys().next().value === '☑️') {
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
            emojis = ['❌', '☑️'];

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
                descString += `${i + 1}) <@!${transaction.owner}> paid ${recipients[0].emoji} `
                descString += `[$${(transactions[i].value).toFixed(2)}] | ${getFormattedDate(transaction.created)}\n`
            }
        
            embed = new Discord.MessageEmbed()
                .setTitle(`Delete this transaction?`)
                .setDescription(descString)
                .setFooter(`React with ☑️ to confirm or ❌ to cancel this action.`);
            channel.send(embed)
            .then((m) => {
                Promise.all([
                    m.react('☑️'),
                    m.react('❌')
                ]).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector(filter, { time: 120000, dispose: true});
        
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
                    } else if (collected.keys().next().value === '☑️') {
                        resolve(1);
                        confirmed(channel, `Transaction #${number} deleted successfully.`);
                    }
                    m.delete();
                });
            })
        })
    },
    handleRemove: async (channel, authorid, userid) => {
        return new Promise((resolve, reject) => {
            emojis = ['❌', '☑️'];

            var descString = `Removing user <@!${userid}> remove them from the log and not allow them to create new transactions. They will still appear in the transaction log.\n`;
        
            embed = new Discord.MessageEmbed()
                .setTitle(`Remove this user?`)
                .setDescription(descString)
                .setFooter(`React with ☑️ to confirm or ❌ to cancel this action.`);
            channel.send(embed)
            .then((m) => {
                Promise.all([
                    m.react('☑️'),
                    m.react('❌')
                ]).catch(error => console.error('One of the emojis failed to react:', error))
                
    
                const filter = (reaction, user) => {
                    return emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
                };
                
                // collector lasts for 2 minutes before cancelling
                const collector = m.createReactionCollector(filter, { time: 120000, dispose: true});
        
                collector.on('collect', (reaction, user) => {
                    if (user.id === authorid) {
                        collector.stop();
                    }
                });
    
                collector.on('end', collected => {
                    if (collected.length === 0) {
                        resolve(-1);
                        cancelled(channel, `Action timed out - user <@!${userid}> has not been deleted.`);
                    } else if (collected.keys().next().value === '❌') {
                        resolve(0);
                        cancelled(channel, `Action cancelled - user <@!${userid}> has not been removed.`);
                    } else if (collected.keys().next().value === '☑️') {
                        resolve(1);
                        confirmed(channel, `User <@!${userid}> removed successfully.`);
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
        embed:{
            title: `Hello! Thanks for adding me! I'm Moolah, a bot designed to help keep group finances simple. 🐮`,
            thumbnail: {
                url: 'https://i.ibb.co/vZyf66y/Moolah-Logo.png',
            },
            color: 0x2471a3, 
            description: "The prefix for all my commands is '!', e.g: '!help'.\nUse the command !help to see a list of all my commands.",
            footer: { text: 'Moolah created and developed by beexng#2380.' }
        }
    },
    help: {
        embed:{
            title: `My commands:`,
            color: 0x2471a3, 
            description: `Inputs between {} are literals - type the one which fits your need.
Inputs between [] are variables according to what you need to submit.
Inputs which are italicized are optional.
**The brackets are not included in any command, unless you want them in your optional description.**`,
            fields:[
                {
                    name: ':gear: Setup and logistics',
                    value: `!help
!setUser [@user] [emoji]
!setChannel {transactions | moneyLog | alerts} [#channel]
!removeUser [@user]
!clearChannel [#channel]
!userList
!channelList`
                },   
                {
                    name: ':moneybag: Money',
                    value: `!bought [money value to 2 decimals] *[description]*
!paid [money value to 2 decimals] *[emoji of person being paid]*
!owe
!history
!delete [number of transaction to delete]
!clearTransactions`
                },     
            ],
            footer: { text: 'Moolah created and developed by beexng#2380.' }
        }
    }
};