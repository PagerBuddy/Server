"use strict";
const fs = require('fs');
const config = require("../config.json");
const path = require('path');

//TODO: Backup currently deos not work as ndoe process does not have sufficient privileges to create folders or files


/**
 * Copy the current DB to the specified file.
 * @param {string} file The destination for the backup file.
 */
function copy_db(file) {


    //TODO: This should be more sophisticated (i.e. a cloud location). And we should add some safeguards for corrupt DB.
    fs.copyFileSync(config.DATABASE_LOCATION, file);
}

exports.perform_backup = perform_backup;
function perform_backup() {
    /**
     * Copies a date-stamped version of the current db to the location specified in config.json and copies the config itself for safekeeping.
     */


    fs.mkdirSync(path.resolve(config.BACKUP_LOCATION), { recursive: true });

    const timestamp = get_current_timestamp();
    const backup_file = config.BACKUP_LOCATION + "/data-" + timestamp + ".db";

    copy_db(backup_file);

    const backup_config = config.BACKUP_LOCATION + "/config.json";
    fs.copyFileSync("./config.json", backup_config);

}

/**
 * 
 * @returns {string} String representation of the current time (trying to mimic the YYYYMMDD-HHMMSS format)
 */
function get_current_timestamp() {
    const stamp = new Date(Date.now());
    /** @type {string} */
    var timeString = stamp.getFullYear() .toString()+ stamp.getMonth().toString() + stamp.getDay().toString();
    timeString += "-" + stamp.getHours() .toString()+ stamp.getMinutes().toString() + stamp.getSeconds().toString();

    return timeString;
}