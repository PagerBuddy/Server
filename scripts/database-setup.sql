CREATE TABLE "ZVEI" (
"zvei_id" INTEGER NOT NULL,         -- a ZVEI id (f.e. 25978)
"description" TEXT NOT NULL,        -- a freetext ([0-9A-Za-z\s]) description of the ZVEI
"test_day" INTEGER NOT NULL,        -- Integer for the day of the week when alerts are inactive (Mo = 0?)
"test_time_start" TEXT NOT NULL,
"test_time_end" TEXT NOT NULL,
PRIMARY KEY("zvei_id")
);

INSERT INTO "ZVEI" VALUES
(1, "SYSTEM DEBUG", 0, "00:00", "00:00"),
(2, "SYSTEM INFO", 0, "00:00", "00:00"),
(3, "SYSTEM WARNING", 0, "00:00", "00:00"),
(4, "SYSTEM ERROR", 0, "00:00", "00:00"),
(5, "SYSTEM REPORT", 0, "00:00", "00:00"),
(10, "SYSTEM ALL ALERTS", 0, "00:00", "00:00");


CREATE TABLE "Groups" (
"group_id" INTEGER NOT NULL,
"description" TEXT NOT NULL UNIQUE,
"chat_id" TEXT UNIQUE,
"auth_token" TEXT UNIQUE,
PRIMARY KEY("group_id")
);

CREATE TABLE "Alarms" (
"zvei_id" INTEGER NOT NULL,
"group_id" INTEGER NOT NULL,
FOREIGN KEY("zvei_id") REFERENCES "ZVEI"("zvei_id") ON DELETE CASCADE,
FOREIGN KEY("group_id") REFERENCES "Groups"("group_id") ON DELETE CASCADE,
PRIMARY KEY("zvei_id","group_id")
);

CREATE TABLE "Users" (
"user_id" INTEGER UNIQUE, 
"token" TEXT NOT NULL,
"token_type" TEXT NOT NULL,
PRIMARY KEY("user_id")
);

CREATE TABLE "UserGroups" (
"user_id" INTEGER NOT NULL,
"group_id" INTEGER NOT NULL,
FOREIGN KEY("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE,
FOREIGN KEY("group_id") REFERENCES "Groups"("group_id") ON DELETE CASCADE,
PRIMARY KEY("user_id", "group_id")
);

CREATE TABLE "AlarmHistory"(
"zvei_id" INTEGER NOT NULL,
"timestamp" INTEGER NOT NULL,       
"alert_level" INTEGER NOT NULL,   -- How much information content the alert had. Only higher information content should be repeated. 1 = ZVEI, 2 = Tetra, 3 = SMS, 4 = Fax
FOREIGN KEY("zvei_id") REFERENCES "ZVEI"("zvei_id") ON DELETE CASCADE
);

