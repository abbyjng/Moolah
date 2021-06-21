const Discord = require('discord.js');
const auth = require('./auth.json');
const fs = require('fs');

const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');
const open = sqlite.open;

const embedHandler = require('./embedHandler.js')

let db;

// Initialize Discord Bot
const intents = ["GUILDS", "GUILD_MEMBERS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILD_EMOJIS"];
const partials = ['GUILD_MEMBER'];
const client = new Discord.Client({intents: intents, partials: partials, ws:{intents: intents}, disableEveryone: false});

client.on("ready", async () => {
    // open database
    open({
        filename: './database/database.db',
        driver: sqlite3.Database
    }).then((dbOpened) => {
        db = dbOpened;
        console.log("Connected to sqlite3 database.")

        // create all the tables if they have not yet been created
        const schema = fs.readFileSync('./database/schema.sql').toString();
        const schemaArr = schema.toString().split(');');

        db.getDatabaseInstance().serialize(() => {
            db.run('PRAGMA foreign_keys=OFF;');
            schemaArr.forEach((query) => {
                if (query) {
                    query += ');';
                    db.run(query)
                }
            });
        });

        console.log(`Logged in as ${client.user.tag}!`);
    })
});

client.on('guildCreate', server => {
    // add server to the database
    sql = `INSERT INTO servers (serverid, transactionsid, logid, alertsid) 
                        VALUES (?, "", "", "");`
    db.run(sql, [server.id.toString()]);

    // send initial message
    let defaultChannel = "";
    server.channels.cache.forEach((channel) => {
        if (channel.type == "text" && defaultChannel == "") {
            if (channel.permissionsFor(server.me).has("SEND_MESSAGES")) {
                defaultChannel = channel;
            }
        }
    })
    //defaultChannel will be the channel object that it first finds the bot has permissions for
    defaultChannel.send(embedHandler.welcome);
});

client.on('guildDelete', server => {
    db.run(`DELETE FROM servers WHERE serverid = ?;`, [server.id]);
});

client.on("message", async function(message) {
    if (message.content.substring(0, 1) == '/') {
        let args = message.content.substring(1).split(' ');
        const cmd = args[0].toLowerCase();
        args = args.splice(1);

        server = message.guild;
        channel = message.channel;

        switch(cmd) {
            // setup and logistics
            case 'help':
                channel.send(embedHandler.help);
                break;
            case 'setuser':
                setUser = server.members.cache.find(user => user.id === args[0].slice(3, -1));
                if (!setUser) {
                    channel.send(`User could not be set. Link user query like so: <@839639502767259669>`)
                    break;
                }
                sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ? AND status = 1`
                result = await db.get(sql, [args[1], server.id]);
                if (result) {
                    channel.send(`Emoji could not be set. This emoji has already been assigned to <@${result.userid}>.`)
                    break;
                } else {
                    updateMoneyLog(server)
                    
                    if (args[1].charAt(0) == "<") { // server specific emoji
                        // search for emoji within server
                        emoji = server.emojis.cache.find(emoji => emoji.id === args[1].slice(args[1].indexOf(":", 2) + 1, -1));
                        if (!emoji) { // emoji doesn't exist in server
                            channel.send(`Emoji could not be set. Emojis must be default or available in this server.`)
                            break;
                        }
                        sql = `INSERT OR REPLACE INTO users (serverid, userid, emoji, status) 
                                        VALUES (?, ?, ?, 1);`;
                        db.run(sql, [server.id, setUser.id, args[1]]);
                    } else { // default emoji
                        if (args[1] == '☑️') {
                            channel.send(`Emoji could not be set. ☑️ is an invalid emoji, try something else.`);
                            break;
                        } else if (args[1] == '❌') {
                            channel.send(`Emoji could not be set. ❌ is an invalid emoji, try something else.`);
                        }
                        sql = `INSERT OR REPLACE INTO users (serverid, userid, emoji, status) 
                                        VALUES (?, ?, ?, 1);`;
                        db.run(sql, [server.id, setUser.id, args[1]]);
                    }
    
                    channel.send({embed:{ 
                        description: `User ${args[0]} successfully set to ${args[1]}.` 
                    }});
                }
                break;
            case 'removeuser':
                removeUser = server.members.cache.find(user => user.id === args[0].slice(3, -1));
                if (!removeUser) {
                    channel.send(`User could not be removed. Link user query like so: <@839639502767259669>`)
                    break;
                }
                
                (async function() {
                    embedHandler.handleRemove(channel, message.author.id, args[0].slice(3, -1))
                    .then((result) => {
                        if (result === 1) {
                            updateMoneyLog(server);
                            db.run(`UPDATE users SET status = 0 WHERE userid = ? AND serverid = ?;`, [args[0].slice(3, -1), server.id]);
                        }
                    });
                })();
                break;
            case 'userlist':
                sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
                users = await db.all(sql, [server.id])
                channel.send({ embed:{ fields: [{
                    name: `User list`,
                    value: getFormattedUsers(users).slice(0, -1) || `No users set.`
                }]}})
                break;
            case 'channellist':
                sql = `SELECT transactionsid, logid, alertsid FROM servers WHERE serverid = ?`;
                channels = ""
                val = await db.get(sql, [server.id])
                channels += `Transactions channel: `
                channels += val.transactionsid ? `<#${val.transactionsid}>\n` : `not set\n`

                channels += `Money log channel: `
                channels += val.logid ? `<#${val.logid}>\n` : `not set\n`
                
                channels += `Alerts channel: `
                channels += val.alertsid ? `<#${val.alertsid}>\n` : `not set\n`

                channel.send({ embed:{ fields: [{
                    name: `Channel list`,
                    value: channels
                }]}})
                break;
            case 'setchannel':
                if (args.length < 2) {
                    channel.send(`Invalid command usage: /setchannel [ transactions | moneyLog | alerts ] [#channel]`)
                    break;
                }
                setChannel = server.channels.cache.get(args[1].slice(2,-1))
                if (!setChannel) {
                    channel.send(`Channel could not be set. Link channel query like so: <#${channel.id}>`);
                    break;
                }
                if (setChannel.type == "text" && setChannel.permissionsFor(server.me).has("SEND_MESSAGES")) {
                    switch(args[0].toLowerCase()) {
                        case 'transactions':
                            sql = `UPDATE servers SET transactionsid = ? WHERE serverid = ?;`
                            db.run(sql, [setChannel.id, server.id]).then(() => {
                                channel.send({embed:{ 
                                    description: `<#${setChannel.id}> has successfully been set as the transactions channel.` 
                                }});
                            });
                            break;
                        case 'moneylog':
                            sql = `UPDATE servers SET logid = ? WHERE serverid = ?;`
                            db.run(sql, [setChannel.id, server.id]).then(() => {
                                updateMoneyLog(server, setChannel.id);
                                channel.send({embed:{ 
                                    description: `<#${setChannel.id}> has successfully been set as the money log channel.` 
                                }});
                            });
                            break;
                        case 'alerts':
                            sql = `UPDATE servers SET alertsid = ? WHERE serverid = ?;`
                            db.run(sql, [setChannel.id, server.id]).then(() => {
                                channel.send({embed:{ 
                                    description: `<#${setChannel.id}> has successfully been set as the alerts channel.` 
                                }});
                            });
                            break;
                        default:
                            channel.send("Invalid channel type. Valid types: transactions | moneyLog | alerts '")
                    }
                } else {
                    channel.send(`Channel could not be set. Make sure this bot has permissions to send messages in ${args[1]}`);
                }
                break;
            case 'clearchannel':
                if (args.length < 1) {
                    channel.send(`Invalid command usage: /clearchannel [transactions | moneyLog | alerts ]`)
                    break;
                }
                switch(args[0].toLowerCase()) {
                    case 'transactions':
                        sql = `UPDATE servers SET transactionsid = "" WHERE serverid = ?;`
                        break;
                    case 'moneylog':
                        sql = `UPDATE servers SET logid = "" WHERE serverid = ?;`
                        break;
                    case 'alerts':
                        sql = `UPDATE servers SET alertsid = "" WHERE serverid = ?;`
                        break;
                    default:
                        channel.send("Invalid channel type entered. Valid types: 'transactions', 'moneyLog', 'alerts'")
                }
                db.run(sql, [server.id]).then(() => {
                    channel.send({embed:{ 
                        description: `Channel has been cleared successfully.` 
                    }});
                });
                break;
            
            // money commands
            case 'bought':
                if (!(await checkValidUser(message.author.id, server.id, channel))) { break; }
                sql = `SELECT transactionsid, logid, logembed FROM servers WHERE serverid = ?`;
                data = await db.get(sql, [server.id]);
                if (data.transactionsid == '' || data.transactionsid == channel.id) {
                    if (args.length == 0) {
                        channel.send(`Invalid command usage: /bought [value] [description of transaction]`)
                        break;
                    }
                    cost = args[0];
                    description = args.splice(1).join(' ');

                    if (cost.charAt(0) === '$') { // remove $ if it has one
                        cost = cost.slice(1);
                    }
                    if (isNaN(cost)) {
                        channel.send(`Invalid command usage: the value submitted is not a number.`);
                        break;
                    }
                    if (cost <= 0) {
                        channel.send(`Invalid command usage: the value submitted must be a positive value.`);
                        break;
                    }
                    if (description === "defaultPaidDescription") {
                        channel.send(`Congrats! You've found the one description message you are not allowed to use. Please try again.`);
                        break;
                    }
                    if (description.length > 200) {
                        channel.send(`Invalid command usage: the description submitted must be <200 characters long.`);
                        break;
                    }

                    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
                    users = await db.all(sql, [server.id]);
                    (async function() {
                        embedHandler.handleTransaction(channel, message.author.id, users, getFormattedUsers(users), cost, description)
                        .then((recipients) => {
                            if (recipients[0] !== 0 && recipients[0] !== -1) {
                                updateMoneyLog(server);
                                sql = `INSERT INTO transactions (serverid, value, description)
                                       VALUES (?, ?, ?);`;
                                db.run(sql, [server.id, cost/recipients.length, description]).then(() => {
                                    db.run("SELECT last_insert_rowid()").then((transactionid) => {
                                        recipients.forEach((recipient) => {
                                            sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                                    VALUES (?, ?, ?, ?);`;
                                            db.run(sql, [server.id, transactionid.lastID, message.author.id, recipient.userid]);
                                        })
                                    });
                                });
                            }
                        });
                    })();
                }
                break;
            case 'paid':
                if (!(await checkValidUser(message.author.id, server.id, channel))) { break; }
                sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
                data = await db.get(sql, [server.id]);
                if (data.transactionsid == '' || data.transactionsid == channel.id) {
                    if (args.length == 0 || args.length > 2) {
                        channel.send(`Invalid command usage: /paid [value] [emoji of recipient]`)
                        break;
                    }
                    cost = args[0];

                    if (cost.charAt(0) === '$') { // remove $ if it has one
                        cost = cost.slice(1);
                    }
                    if (isNaN(cost)) {
                        channel.send(`Invalid command usage: the value submitted is not a number.`);
                        break;
                    }
                    if (cost <= 0) {
                        channel.send(`Invalid command usage: the value submitted must be a positive value.`);
                        break;
                    }

                    if (args.length == 1) {
                        // do embed
                        sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
                        users = await db.all(sql, [server.id]);
                        (async function() {
                            embedHandler.handlePayment(channel, message.author.id, users, getFormattedUsers(users, message.author.id), cost)
                            .then((recipient) => {
                                if (recipient !== 0 && recipient !== -1) {
                                    updateMoneyLog(server);
                                    sql = `INSERT INTO transactions (serverid, value, description)
                                            VALUES (?, ?, "defaultPaidDescription")`
                                    db.run(sql, [server.id, cost]).then(() => {
                                        db.run("SELECT last_insert_rowid()").then((transactionid) => {
                                            sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                                    VALUES (?, ?, ?, ?);`;
                                            db.run(sql, [server.id, transactionid.lastID, message.author.id, recipient.userid]);
                                        });
                                    });
                                }
                            })
                        })();
                    } else {
                        // try emoji
                        sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ? AND status = 1`;
                        userid = await db.get(sql, [args[1], server.id]);
                        if (!userid) {
                            channel.send(`User not found: ${args[1]} is not associated with any user in this server.`);
                            break;
                        }
                        userid = userid.userid
                        if (userid === message.author.id) {
                            channel.send(`Why are you trying to pay yourself? That's not allowed`);
                            break;
                        }
                        updateMoneyLog(server);
                        // insert into transactions
                        sql = `INSERT INTO transactions (serverid, value, description)
                               VALUES (?, ?, "defaultPaidDescription")`
                        db.run(sql, [server.id, cost]).then(() => {
                            db.run("SELECT last_insert_rowid()").then((transactionid) => {
                                sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                        VALUES (?, ?, ?, ?);`;
                                db.run(sql, [server.id, transactionid.lastID, message.author.id, userid]);
                            });
                        });
                        embedHandler.confirmPayment(channel, message.author.id, userid, args[1], cost);
                    }
                }
                break;
            case 'owe':
                if (!(await checkValidUser(message.author.id, server.id, channel))) { break; }
                sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
                data = await db.get(sql, [server.id]);
                if (data.transactionsid == '' || data.transactionsid == channel.id) {
                    // get sql - owner, recipient, cost, inner join with users table for emojis
                    var owe = {}
                    sql =  `SELECT
                                value,
                                emoji
                            FROM
                                transactions as t 
                                INNER JOIN 
                                transactionhands as th
                                ON t.transactionid = th.transactionid
                                INNER JOIN 
                                users as u
                                ON th.recipient = u.userid
                            WHERE
                                th.owner = ?
                                AND th.recipient != ?
                                AND t.serverid = ?
                                AND u.serverid = ?
                                AND u.status = 1`;
                    db.all(sql, [message.author.id, message.author.id, server.id, server.id]).then((transactions) => {
                        transactions.forEach((t) => {
                            if (!(t.emoji in owe)) {
                                owe[t.emoji] = 0
                            }
                            owe[t.emoji] += t.value
                        })
                        sql =  `SELECT
                                value,
                                emoji
                            FROM
                                transactions as t 
                                INNER JOIN 
                                transactionhands as th
                                ON t.transactionid = th.transactionid
                                INNER JOIN 
                                users as u
                                ON th.owner = u.userid
                            WHERE
                                th.recipient = ?
                                AND th.owner != ?
                                AND t.serverid = ?
                                AND u.serverid = ?
                                AND u.status = 1`;
                        db.all(sql, [message.author.id, message.author.id, server.id, server.id]).then((transactions) => {
                            transactions.forEach((t) => {
                                if (!(t.emoji in owe)) {
                                    owe[t.emoji] = 0;
                                }
                                owe[t.emoji] -= t.value
                            })

                            oweyou = ``;
                            for (var key in owe) {
                                if (owe[key] > 0) {
                                    oweyou += `${key}: $${owe[key].toFixed(2)}\n`
                                }
                            }
                            if (oweyou === ``) { oweyou = `None`; }

                            youowe = ``;
                            for (var key in owe) {
                                if (owe[key] < 0) {
                                    youowe += `${key}: $${(-owe[key]).toFixed(2)}\n`
                                }
                            }
                            if (youowe === ``) { youowe = `None`; }

                            channel.send({ embed:{ fields: [
                                {
                                    name: `**Owes you:**`,
                                    value: oweyou,
                                    inline: true
                                },
                                {
                                    name: `**You owe:**`,
                                    value: youowe,
                                    inline: true
                                }
                            ]}})
                        })
                    })
                }

                break;
            case 'history':
                if (!(await checkValidUser(message.author.id, server.id, channel))) { break; }
                sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
                data = await db.get(sql, [server.id]);
                if (data.transactionsid == '' || data.transactionsid == channel.id) {
                    // get all transactionids in this server
                    sql = ` SELECT 
                                transactionid, 
                                value, 
                                description, 
                                created 
                            FROM 
                                transactions 
                            WHERE 
                                serverid = ?`;

                    transactionids = await db.all(sql, [server.id]);

                    // loop thru them all and get info for each one
                    tlist = []
                    invalidTransactions = 0; // deal with this later lol
                    if (transactionids.length === 0) { // no transactions
                        embedHandler.handleNoTransactions(channel);
                    }
                    transactionids.forEach((id) => {
                        sql = ` SELECT 
                                    owner,  
                                    emoji
                                FROM
                                    transactionhands INNER JOIN users 
                                    ON transactionhands.recipient = users.userid AND 
                                       transactionhands.serverid = users.serverid
                                WHERE 
                                    transactionid = ?`
                        db.all(sql, [id.transactionid]).then((tarray) => {
                            if (tarray.length > 0) {
                                tlist.push({
                                    value: id.value,
                                    description: id.description,
                                    created: id.created,
                                    owner: tarray[0].owner,
                                    emojis: tarray.map(t => t.emoji )
                                })
                            } else {
                                invalidTransactions += 1
                            }

                            if (tlist.length + invalidTransactions === transactionids.length) {
                                // sort by created
                                tlist.sort(function(a,b){ 
                                    if (a.created > b.created) return 1;
                                    else return -1;
                                });
                                embedHandler.handleLog(channel, tlist, message.author.id)
                            }
                        })
                    })
                }
                break;
            case 'delete':
                if (!(await checkValidUser(message.author.id, server.id, channel))) { break; }
                sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
                data = await db.get(sql, [server.id]);
                if (data.transactionsid == '' || data.transactionsid == channel.id) {
                    if (args.length == 0) {
                        channel.send(`Invalid command usage: /delete [transaction number to delete]`)
                        break;
                    }
                    num = args[0];

                    if (isNaN(num) && num !== "last") {
                        channel.send(`Invalid command usage: the value submitted is not a number.`);
                        break;
                    }
                    if (num <= 0) {
                        channel.send(`Invalid command usage: the value submitted must be a positive value.`);
                        break;
                    }

                    // get all transactionids in this server
                    sql = ` SELECT 
                                transactionid, 
                                value, 
                                description, 
                                created 
                            FROM 
                                transactions 
                            WHERE 
                                serverid = ?`;

                    transactionids = await db.all(sql, [server.id]);

                    if (num === "last") {
                        num = transactionids.length;
                    }

                    transactionids.sort(function(a,b){ 
                        if (a.created > b.created) return 1;
                        else return -1;
                    });

                    if (num > transactionids.length) {
                        channel.send(`Invalid command usage: ${num} is not a valid transaction number.`);
                    } else {
                        sql = ` SELECT 
                                    owner,  
                                    emoji
                                FROM
                                    transactionhands INNER JOIN users 
                                    ON transactionhands.recipient = users.userid AND 
                                       transactionhands.serverid = users.serverid
                                WHERE 
                                    transactionid = ?`;
                        
                        recipients = await db.all(sql, [transactionids[num - 1].transactionid]);

                        (async function() {
                            embedHandler.handleDelete(channel, message.author.id, transactionids[num - 1], recipients, num)
                            .then((result) => {
                                if (result === 1) {
                                    updateMoneyLog(server);
                                    transactionid = transactionids[num-1].transactionid
                                    db.run(`DELETE FROM transactions WHERE serverid = ? AND transactionid = ?;`, [server.id, transactionid]);
                                    db.run(`DELETE FROM transactionhands WHERE serverid = ? AND transactionid = ?;`, [server.id, transactionid]);
                                }
                            });
                        })();
                    }
                }
                break;
            case 'cleartransactions':
                if (!(await checkValidUser(message.author.id, server.id, channel))) { break; }
                sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
                data = await db.get(sql, [server.id]);
                if (data.transactionsid == '' || data.transactionsid == channel.id) {
                    (async function() {
                        embedHandler.handleClear(channel, message.author.id)
                        .then((result) => {
                            if (result === 1) {
                                updateMoneyLog(server);
                                db.run(`DELETE FROM transactions WHERE serverid = ?;`, [server.id]);
                                db.run(`DELETE FROM transactionhands WHERE serverid = ?;`, [server.id]);
                            }
                        });
                    })();
                }
                break;
        }
     }
});

client.on("emojiDelete", async function(emoji) {
    // see if emoji is connected to a user
    sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ?`
    user = await db.get(sql, [`<:${emoji.name}:${emoji.id}>`, emoji.guild.id]);
    if (user) {
        // delete user from the table, add to deleted users
        db.run(`UPDATE users SET status = 0 WHERE userid = ? AND serverid = ?;`, [user.userid, emoji.guild.id]);

        // update moneylog embed without the user
        updateMoneyLog(emoji.guild)

        // send message warning user to re-add the user with a new emoji
        sql = `SELECT alertsid FROM servers WHERE serverid = ?`;
        s = db.run(sql, [emoji.guild.id])
        defaultChannel = "";
        if (s.alertsids) {
            defaultChannel = emoji.guild.channels.cache.get(s.alertsid);
        } else {
            channel.guild.channels.cache.forEach((channel) => {
                if (channel.type == "text" && defaultChannel == "") {
                    if (channel.permissionsFor(channel.guild.me).has("SEND_MESSAGES")) {
                        defaultChannel = channel;
                    }
                }
            })
        }
        //defaultChannel will be the channel object that it first finds the bot has permissions for
        defaultChannel.send({
            embed:{
                title: `‼️ WARNING ‼️`,
                color: 0xFF0000, 
                description: `The emoji previously called :${emoji.name}: was deleted.
                This emoji was connected to <@${user.userid}>. Please assign a new emoji to <@${user.userid}>. Until this is done, this user will be removed from the database.`
            }
        });
    }
});

client.on("emojiUpdate", async function(oldEmoji, newEmoji) {
    // see if emoji is connected to a user
    sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ?`
    user = await db.get(sql, [`<:${oldEmoji.name}:${oldEmoji.id}>`, oldEmoji.guild.id]);
    if (user) {
        // update emoji in sql
        db.run(`UPDATE users SET emoji = ? WHERE userid = ? AND serverid = ?;`, [`<:${newEmoji.name}:${newEmoji.id}>`, user.userid, oldEmoji.guild.id]);

        // update moneylog embed
        updateMoneyLog(newEmoji.guild);
    }
});

client.on("channelDelete", async function(channel) {
    sql = `SELECT * FROM servers WHERE serverid = ? 
            AND (transactionsid = ? 
              OR logid = ?
              OR alertsid = ?)`
    s = await db.get(sql, [channel.guild.id, channel.id, channel.id, channel.id]);
    let ch = "";
    if (s) {
        switch (channel.id) {
            case s.transactionsid:
                ch = "transactions";
                db.run(`UPDATE servers SET transactionsid = "" WHERE serverid = ?;`, [s.serverid]);
                break;
            case s.logid:
                ch = "log";
                db.run(`UPDATE servers SET logid = "" WHERE serverid = ?;`, [s.serverid]);
                break;
            case s.alertsid:
                ch = "alerts";
                db.run(`UPDATE servers SET alertsid = "" WHERE serverid = ?;`, [s.serverid]);
                break;
        }

        // send message warning that the channel has been unset
        let defaultChannel = "";
        if (s.alertsid && ch != "alerts") {
            defaultChannel = channel.guild.channels.cache.get(s.alertsid);
        } else {
            channel.guild.channels.cache.forEach((channel) => {
                if (channel.type == "text" && defaultChannel == "") {
                    if (channel.permissionsFor(channel.guild.me).has("SEND_MESSAGES")) {
                        defaultChannel = channel;
                    }
                }
            })
        }
        
        //defaultChannel will be the channel object that it first finds the bot has permissions for
        defaultChannel.send({
            embed:{
                title: `‼️ WARNING ‼️`,
                color: 0xFF0000, 
                description: `The channel previously set as the ${ch} channel has been deleted. This channel has been unset.`
            }
        });
    }
});

client.on("channelUpdate", async function(oldChannel, newChannel) {
    // see if channel is assigned
    sql = `SELECT * FROM servers WHERE serverid = ? 
            AND (transactionsid = ? 
              OR logid = ?
              OR alertsid = ?)`
    s = await db.get(sql, [oldChannel.guild.id, oldChannel.id, oldChannel.id, oldChannel.id]);
    if (s) {
        if (setChannel.type !== "text" || !setChannel.permissionsFor(server.me).has("SEND_MESSAGES")) {
                console.log(newChannel.type)
                console.log(newChannel.permissionsFor(newChannel.guild.me))
            let ch = "";
            switch (oldChannel.id) {
                case s.transactionsid:
                    ch = "transactions";
                    db.run(`UPDATE servers SET transactionsid = "" WHERE serverid = ?;`, [s.serverid]);
                    break;
                case s.logid:
                    ch = "log";
                    db.run(`UPDATE servers SET logid = "" WHERE serverid = ?;`, [s.serverid]);
                    break;
                case s.alertsid:
                    ch = "alerts";
                    db.run(`UPDATE servers SET alertsid = "" WHERE serverid = ?;`, [s.serverid]);
                    break;
            }

            // send message warning that the channel has been unset
            if (s.alertsid && ch != "alerts") {
                defaultChannel = oldChannel.guild.channels.cache.get(s.alertsid);;
            } else {
                channel.guild.channels.cache.forEach((channel) => {
                    if (channel.type == "text" && defaultChannel == "") {
                        if (channel.permissionsFor(channel.guild.me).has("SEND_MESSAGES")) {
                            defaultChannel = channel;
                        }
                    }
                })
            }

            //defaultChannel will be the channel object that it first finds the bot has permissions for
            defaultChannel.send({
                embed:{
                    title: `‼️ WARNING ‼️`,
                    color: 0xFF0000, 
                    description: `The channel previously set as the ${ch} channel has been changed so that Moolah no longer can access it. This channel has been unset.`
                }
            });
        }
    }
});

client.on("messageDelete", async function(message) {
    if (message.author.id === client.user.id) {
        sql = `SELECT logembed, alertsid FROM servers WHERE serverid = ?`;
        data = await db.get(sql, [message.guild.id]);
        if (data.logembed === message.id) {
            // AAAHH PANIC PANIC EVERYONE PANIC

            // jk everything is okay
            updateMoneyLog(message.guild, message.channel.id);

            // send message warning that the channel has been unset
            if (data.alertsid) {
                defaultChannel = message.guild.channels.cache.get(data.alertsid);
            } else {
                channel.guild.channels.cache.forEach((channel) => {
                    if (channel.type == "text" && defaultChannel == "") {
                        if (channel.permissionsFor(channel.guild.me).has("SEND_MESSAGES")) {
                            defaultChannel = channel;
                        }
                    }
                })
            }
            //defaultChannel will be the channel object that it first finds the bot has permissions for
            defaultChannel.send({
                embed:{
                    title: `⚠️ WARNING ⚠️`,
                    color: 0xFFFF00, 
                    description: `Did you mean to delete the log message? If you wish to unset the log channel, send \`/clearChannel moneyLog\`.`
                }
            });
        }
    }
});

client.on("guildMemberRemove", async function(member) {
    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`
    user = await db.get(sql, [member.id, member.guild.id]);
    if (user) {
        // delete user from the table, add to deleted users
        db.run(`UPDATE users SET status = 0 WHERE userid = ? AND serverid = ?;`, [user.userid, member.guild.id]);

        // update moneylog embed without the user
        updateMoneyLog(member.guild)

        // send message warning user to re-add the user with a new emoji
        sql = `SELECT alertsid FROM servers WHERE serverid = ?`;
        s = db.run(sql, [member.guild.id])
        if (s.alertsid) {
            defaultChannel = member.guild.channels.cache.get(s.alertsid);
        } else {
            channel.guild.channels.cache.forEach((channel) => {
                if (channel.type == "text" && defaultChannel == "") {
                    if (channel.permissionsFor(channel.guild.me).has("SEND_MESSAGES")) {
                        defaultChannel = channel;
                    }
                }
            })
        }

        //defaultChannel will be the channel object that it first finds the bot has permissions for
        defaultChannel.send({
            embed:{
                title: `‼️ WARNING ‼️`,
                color: 0xFF0000, 
                description: `The user <@${member.id}> has left this server. They have been removed from the database.`
            }
        });
    }
});

async function updateMoneyLog(server, newchannel = "") {
    if (newchannel !== "") {
        c = server.channels.cache.get(newchannel);
        var logmsg = await getLogMessage(server.id);
        var e = new Discord.MessageEmbed()
            .setTitle(`Money log`)
            .setDescription(logmsg)
        c.send(e).then((m) => {
            sql = `UPDATE servers SET logembed = ? WHERE serverid = ?;`
            db.run(sql, [m.id, server.id]);
        });
    } else {
        sql = `SELECT logid, logembed FROM servers WHERE serverid = ?`;
        data = await db.get(sql, [server.id]);
        if (data.logid != '') {
            c = server.channels.cache.get(data.logid);
            c.messages.fetch(data.logembed)
                .then((oldEmbed) => {
                    (async function() {
                        var logmsg = await getLogMessage(server.id);
                        embed = new Discord.MessageEmbed()
                                .setTitle(`Money log`)
                                .setDescription(logmsg)
                        oldEmbed.edit(embed)
                    })();
                })
            .catch(console.error);
        }
    }
}

function getFormattedUsers(users, userid = null) {
    formUsers = ""
    users.forEach(row => {
        if (row.userid !== userid) {
            formUsers += `${row.emoji} → `
            formUsers += `<@${row.userid}>\n`;
        }
    })
    return formUsers;
}

async function checkValidUser(userid, serverid, channel) {
    return new Promise((resolve, reject) => {
        sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
        db.get(sql, [userid, serverid]).then((val) => {
            if (val) {
                resolve(true);
            } else {
                sql = `SELECT userid FROM users WHERE serverid = ? AND status = 1`;
                db.get(sql, [serverid]).then((users) => {
                    if (!users) {
                        channel.send(`No users are set. Set up users using \`/setUser [@user] [emoji]\`.`);
                    }
                });
                resolve(false);
            }
        })
    });
}

async function getLogMessage(serverid) {
    return new Promise((resolve, reject) => {
        var log = {}
        // populate the log dictionary with users
        sql =  `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
        db.all(sql, [serverid]).then((users) => {
            if (users.length <= 1) {
                resolve(`No transactions available.`)
            }
            users.forEach((user) => {
                log[user.userid] = {}
                users.forEach((otherUser) => {
                    if (otherUser.userid != user.userid) {
                        log[user.userid][otherUser.userid] = {value: 0, emoji: otherUser.emoji}
                    }
                }) 
            })

            // get all transactions and handle them
            sql =  `SELECT
                        owner,
                        recipient,
                        value
                    FROM
                        transactions as t 
                        INNER JOIN 
                        transactionhands as th
                        ON t.transactionid = th.transactionid
                    WHERE
                        th.owner != th.recipient
                        AND t.serverid = ?`;
            db.all(sql, [serverid]).then((transactions) => {
                transactions.forEach((t) => {
                    if (t.recipient in log) {
                        if (t.owner in log[t.recipient]) {
                            if (log[t.owner][t.recipient].value > t.value) {
                                log[t.owner][t.recipient].value -= t.value;
                            } else if (log[t.owner][t.recipient].value > 0) {
                                log[t.recipient][t.owner].value = t.value - log[t.owner][t.recipient].value;
                                log[t.owner][t.recipient].value = 0;
                            } else {
                                log[t.recipient][t.owner].value += t.value;
                            }
                        }
                    }
                })

                var logmsg = ``
                for (user in log) {
                    logmsg += `<@${user}> owes:\n`;

                    for (key in log[user]) {
                        logmsg += `$${log[user][key].value.toFixed(2)} to ${log[user][key].emoji} | `
                    }
                    logmsg = logmsg.slice(0, -2) + `\n\n`;
                }

                resolve(logmsg);
            })
        })
    })
}

client.login(auth.token);
