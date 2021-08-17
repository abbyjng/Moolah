const { openDb } = require('./databaseHandler.js')

module.exports = { 
    checkValidUser,
    checkTransactionsChannel
}

async function checkValidUser(userid, serverid) {
    let db = await openDb();
    return new Promise((resolve, reject) => {
        sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
        db.get(sql, [userid, serverid]).then((val) => {
            if (val) {
                resolve(1);
            } else {
                sql = `SELECT userid FROM users WHERE serverid = ? AND status = 1`;
                db.get(sql, [serverid]).then((users) => {
                    if (!users) {
                        resolve(-1);
                    } else {
                        resolve(0);
                    }
                });
            }
        })
    });
}

async function checkTransactionsChannel(channelid, serverid) {
    let db = await openDb();
    return new Promise((resolve, reject) => {
        sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
        db.get(sql, [serverid]).then((data) => {
            if (data.transactionsid == '' || data.transactionsid == channelid) {
                resolve(null);
            } else {
                resolve(data.transactionsid);
            }
        });
    });
}