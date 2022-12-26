ALTER TABLE transactions 
ADD COLUMN type TEXT CHECK(type IN ('DM','SERVER')) DEFAULT "SERVER" NOT NULL ;

ALTER TABLE transactions 
ADD COLUMN category TEXT;

CREATE TABLE IF NOT EXISTS dms(
    userid TEXT PRIMARY KEY,
    logembed TEXT,
    shared INTEGER DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS categories(
    userid TEXT,
    name TEXT,
    PRIMARY KEY (userid, name)
);