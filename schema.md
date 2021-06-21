# SQLite schema

- `servers` table
    - `serverid`, integer
    - `userids`, string
    - `characterids`, string
    - `transactionsid`, int of the transaction channel id
    - `logid`, int of the log channel id
    - `remindersid`, int of the reminders channel id
    - `shoppingid`, int of the shopping channel id

- `transactions` table
    - `serverid`, integer
    - `value`, double
    - `ownerid`, string composed of the characterid of the person creating the transaction
    - `recipients`, string composed of the characterids of those involved
    - `created`, DATETIME type
