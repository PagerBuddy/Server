import * as fs from 'fs';
import sqlite3 from 'sqlite3';
import * as path from "path";
import * as os from 'os';

const config_path = "./config.json";

/**
 * Checks whether the config file exists
 * 
 * Throws an error if the config file does not exist.
 * 
 * @returns {void}
 */
function check_config() {
    /**
     * Check if a config file exists. Die if none is found.
     */

    if (does_file_exist(config_path)) {
        return;
    }

    //Cannot work without config - die here
    throw Error("No config file 'config.json' found. Please edit 'config-template.json', save as 'config.json' and re-run install.");
}


/**
 * Check if a DB file exists. Initialise a blank DB file if none exists.
 */
function initialise_database() {


    const config = JSON.parse(fs.readFileSync(config_path).toString())
    const db_location = config['DATABASE_LOCATION']

    const db_path = path.dirname(db_location);

    if (does_file_exist(db_location)) {
        if (os.platform() == "linux") {
            //Have to set DB permissions
            fs.chmod(db_location, 0o777, () => { });
            fs.chmod(db_path, 0o777, () => { });
        }
        console.log("Databse file found, using it...")
        return;
    }

    //DB file does not exist - lets initialise it
    console.log("No database file found, creating a new one...");
    fs.mkdir(db_path, { recursive: true }, (err) => {
        if (err) {
            console.error(err);
        }
    });
    let db = new sqlite3.Database(db_location, (err) => {
        if (err) {
            console.error(err.message);
            console.error("Could not create database. This is a fatal error!");
        }
    });
    //fs.openSync(db_location, "w");

    const db_setup = fs.readFileSync("./scripts/database-setup.sql").toString();

    db.exec(db_setup, function (/**@type {any} */ err) {
        if (err) {
            console.error(err.message);
            fs.unlinkSync(db_location);
            throw Error("An error occured trying to initialise the database. This is fatal.");
        }
    });

    db.close();

    if (os.platform() == "linux") {
        //Have to set DB permissions
        fs.chmod(db_path, 0o777, () => { });
        fs.chmod(db_location, 0o777, () => { });
    }
}


/**
 * Use  preconfigured config.json and data.db from the folder `lazy-develop` 
 * 
 * The config from the `lazy-develop` folder is copied to the project's main folder and then used.
 * 
 * This method does not override existing files.
 */
function apply_lazy_files() {


    const lazy_config = "./scripts/lazy-develop/config.json";
    const lazy_db = "./scripts/lazy-develop/data.db";

    if (!does_file_exist(config_path) && does_file_exist(lazy_config)) {
        fs.copyFileSync(lazy_config, config_path);
    }

    //Can only apply lazy db file if we already have a config...
    if (does_file_exist(config_path) && does_file_exist(lazy_db)) {
        const config = JSON.parse(fs.readFileSync(config_path).toString())
        const db_location = config['DATABASE_LOCATION']

        if (!does_file_exist(db_location)) {
            fs.mkdirSync(path.dirname(db_location), { recursive: true });
            fs.copyFileSync(lazy_db, db_location);
        }
    }
}

/**
 * Check if a given file exists.
 * @param {String} file -  The filename and path to check.
 * @returns {Boolean} if the file was found.
 */
function does_file_exist(file) {


    try {
        if (fs.existsSync(file)) {
            return true;
        }
    } catch (err) {
        console.error(err);
    }

    return false;
}

apply_lazy_files();
check_config();
initialise_database();