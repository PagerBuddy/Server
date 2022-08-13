"use strict";
/**
 * This modules handles the processing of data using SQLite3.
 */

import sqlite3 from 'sqlite3'
import hat from 'hat';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';

import logging from './logging.mjs'

/** @type {sqlite3.Database} */
let db;

/** @type {string} */
let TIMEZONE = "";

/** @type {number} */
let HISTORY_TIMEOUT_MS;

/** @type {string} */
let DB_PATH = "";

/**@type {winston.Logger} */
let log;

/**
 * 
 * @param {string} timezone 
 * @param {number} history_timeout 
 * @param {string} db_path 
 */
export function init(timezone, history_timeout, db_path) {
    log = logging("DB");
    TIMEZONE = timezone;
    HISTORY_TIMEOUT_MS = history_timeout;
    DB_PATH = db_path;
}

/** 
 * Executes an SQL query with the given parameters.
 * Hint: Implementation using Promises since db.all is an asynchronous function.
 * @param {string} sql SQL query to be executed.
 * @param {Array<string|number>} params list of parameters.
 * @returns {Promise<Array<Object.<String,String|number>>>} result rows.
*/
function sql_query(sql, params) {


    // log.debug("Query: " + sql + "; Params: " + params);


    if (db == null) {
        log.error("Database not connected. Cannot perform query.");
        return Promise.resolve([]);
    }

    /** @type {any[]} */
    var result = [];
    return new Promise((resolve, _) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                log.error(err.message);
                log.error("An error occured trying to perform a query.");
                resolve([]);
            } else {
                //TODO: Why are we actually doing this instead of returning rows??
                rows.forEach(row => {
                    result.push(row);
                });
                // log.debug(`The query returned: ` + JSON.stringify(result));
                resolve(result);
            }
        })
    })
}

/**
 * Executes an SQL command using run.
 * The main difference between sql_query and sql_run is that sql_run does not return values from the DB
 * @param {string} sql The query to be executed
 * @param {Array<string|number>} params
 * @returns {Promise<Boolean>} Whether the query succeeded
 */
async function sql_run(sql, params) {


    // log.debug("Query: " + sql + "; Params: " + params);

    if (db == null) {
        log.error("Database not connected. Cannot perform query.");
        return Promise.resolve(false);
    }


    return new Promise((resolve) => {
        db.run(sql, params, function (/**@type {any} */ err) {
            if (err) {
                log.error(err.message);
                log.error("An error occured trying to perform a query.");
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });

}

/**
 * Ensures input is a valid zvei and has no special characters.
 * @param {number} zvei_id ID of a ZVEI unit. A valid ZVEI always is numerical and between 0 and 99999.
 * @returns {boolean} Whether input is a valid ZVEI.
 */
function is_zvei_safe(zvei_id) {
    let res = typeof (zvei_id) != "number" || zvei_id > 99999 || zvei_id < 0;
    if (res) {
        log.warn("Invalid ZVEI input.");
    }
    return !res;
}

/**
 * Ensures input is a valid telegram chat id (numerical digits, optional -).
 * @param {number} chat_id Chat ID to validate.
 * @returns {boolean} Whether input is a valid chat ID;
 */
function is_chat_id_safe(chat_id) {

    let res = chat_id != 0 && is_numeric_safe(chat_id);
    if (!res) {
        log.warn("Invalid chat ID input.");
    }
    return res;
}

/**
 * Ensures input only contains numeric digits.
 * @param {number} input Number to validate.
 * @returns {boolean} Whether input is a valid number.
 */
function is_numeric_safe(input) {
    return typeof (input) == "number" && !isNaN(input);
}

/**
 * Ensures input only contains valid text characters. Is handled restrictive (A-Za-z0-9_\s).
 * @param {string} text Text to validate.
 * @returns {boolean} Whether input is valid text.
 */
function is_text_safe(text) {
    let re = /^[\wäÄöÖüÜß()\-\s]*$/;
    let res = re.test(text);
    if (!res) {
        log.warn("Text input with invalid characters.");
    }
    return res;
}


/**
 * Ensures input is a valid time in the format HH:mm.
 * @param {string} time Text to validate.
 * @returns {boolean} Whether input is a valid timestamp.
 */
function is_time_safe(time) {


    let re = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    let res = re.test(time);
    if (!res) {
        log.warn("Input is not a valid timestamp.");
    }
    return res;
}

/**
 * Ensures an authentication token contains only valid characters [0-9A-Za-z] and has a length of 10.
 * @param {string} token The authentication token to check.
 * @returns {boolean} Whether input contains only valid characters.
 */
function is_auth_token_safe(token) {


    let re = /^[0-9A-Za-z]{10}$/;
    let res = re.test(token);
    if (!res) {
        log.warn("Input is not a valid authentication token.");
    }
    return res;
}

/**
 * Ensures a FCM device token only contains valid characters [0-9a-zA-Z\-\_] and has a varying length.
 * @param {string} token The FCM device token to check.
 * @returns {boolean} Whether input contains only valid characters.
 */
function is_device_token_safe(token) {


    let re = /^[0-9a-zA-Z\-\_\:]{10,200}$/;
    let res = re.test(token);
    if (!res) {
        log.warn("Input is not a valid FCM device token.");
    }
    return res;
}

/**
 * Replaces a group chat id.
 * @param {number} current_chat_id Old id to be replaced.
 * @param {number} new_chat_id New id.
 */
export async function replace_chat_id(current_chat_id, new_chat_id) {
    if (!is_chat_id_safe(current_chat_id) || !is_chat_id_safe(new_chat_id)) {
        return false;
    }

    const sql = `
        UPDATE Groups
        SET chat_id = ?
        WHERE chat_id = ?
        `;

    const params = [new_chat_id.toString(), current_chat_id.toString()];
    return await sql_run(sql, params);
}

/**
 * Gets the chat_ids linked to a given ZVEI unit.
 * @param {number} zvei_id ID of a ZVEI unit.
 * @returns {Promise<number[]>}  list of chat IDs linked to the ZVEI unit.
 */
export async function get_chat_ids_from_zvei(zvei_id) {

    //zvei_id = parseInt(zvei_id);
    if (!is_zvei_safe(zvei_id)) {
        return [];
    }

    let sql = `
        SELECT Groups.chat_id
        FROM Alarms
        JOIN Groups ON Alarms.group_id = Groups.group_id
        JOIN ZVEI ON Alarms.zvei_id = ZVEI.zvei_id
        WHERE ZVEI.zvei_id = ?
        `;
    let params = [zvei_id];
    let rows = await sql_query(sql, params);

    let chat_ids = [];
    for (let index in rows) {
        chat_ids.push(parseInt(rows[index].chat_id));
    }
    return chat_ids;
}

/**
 * Gets the list of alarm subscriptions for FCM.
 * @returns {Promise<Array<{user_id: number, group_id: number, chat_id: string, token: string}>>} An array of alert subscriptions [[user_id, group_id, chat_id]].
 */
export async function get_check_users_list() {


    let sql = `
        SELECT UserGroups.user_id, UserGroups.group_id, Groups.chat_id, Users.token
        FROM Groups
        JOIN UserGroups ON Groups.group_id = UserGroups.group_id
        JOIN Users ON UserGroups.user_id = Users.user_id
    `;

    let rows = await sql_query(sql, []);
    return rows;
}

/**
 * Gets the FCM device tokens and chatIDs linked to a given ZVEI unit.
 * @param {number} zvei_id ID of a ZVEI unit.
 * @returns {Promise<Array<{token: string, chat_id: string, user_id: number}>>} List of device tokens, chat IDs and user IDs linked to the ZVEI unit.
 */
export async function get_device_ids_from_zvei(zvei_id) {

    //let zvei_id = parseInt(zvei_id_);
    if (!is_zvei_safe(zvei_id)) {
        return [];
    }

    //As 10 is special ID for all alerts also get device ids for 10 - mostly relevant to debugging
    let sql = `
        SELECT Users.token, Groups.chat_id, Users.user_id
        FROM Alarms
        JOIN UserGroups ON Alarms.group_id = UserGroups.group_id
        JOIN Users ON UserGroups.user_id = Users.user_id
        Join Groups ON UserGroups.group_id = Groups.group_id
        WHERE Alarms.zvei_id = ? OR Alarms.zvei_id = 10
        `;
    let params = [zvei_id];
    let rows = await sql_query(sql, params);
    return rows;
}

/**
 * Gets all ZVEIs that are linked to a specific telegram group.
 * @param {number} group_id The group ID to retieve ZVEIs for.
 * @returns {Promise<Array<number>>}: List of ZVEIs linked to the group.
 */
export async function get_zvei_ids_for_group(group_id) {


    //let group_id = parseInt(group_id_);
    if (!is_numeric_safe(group_id)) {
        return [];
    }

    let sql = `
        SELECT ZVEI.zvei_id
        FROM Alarms
        JOIN Groups on Alarms.group_id = Groups.group_id
        JOIN ZVEI ON Alarms.zvei_id = ZVEI.zvei_id
        WHERE Groups.group_id = ?
        ORDER BY ZVEI.zvei_id
        `;

    let params = [group_id];
    let rows = await sql_query(sql, params);
    let zveis = [];
    for (let index in rows) {
        zveis.push(rows[index].zvei_id);
    }
    return zveis;
}

/**
 * Checks if a given time is inside the test alarm window of a ZVEI unit.
 * @param {number} zvei_id ID of a ZVEI unit.
 * @param {number} timestamp: the time to be checked.
 * @returns {Promise<boolean>}  true if the given time is inside the test alarm window, false otherwise
 */
export async function is_test_time(zvei_id, timestamp) {

    //let zvei_id = parseInt(zvei_id_);

    if (!is_zvei_safe(zvei_id)) {
        return false;
    }

    let sql = `
        SELECT test_day, test_time_start, test_time_end
        FROM ZVEI
        WHERE zvei_id = ?
        `;
    let params = [zvei_id];
    
    /**@type {Array.<{test_day: number, test_time_start: string, test_time_end: string}>} */
    let rows = await sql_query(sql, params);

    if (rows.length < 1) {
        //ZVEI is not known
        return false;
    }

    let test_day = rows[0].test_day;
    let test_time_start = rows[0].test_time_start;
    let test_time_end = rows[0].test_time_end;

    let date = new Date(timestamp);
    let current_day = date.getDay();
    let current_time = date.toLocaleTimeString("de-DE", { timeZone: TIMEZONE });

    return (current_day == test_day && test_time_start <= current_time && current_time <= test_time_end);
}

/**
 * Gets all ZVEI units.
 * @returns {Promise<Array<{zvei_id: number, description: string, test_day: number, test_time_start: string, test_time_end: string}>>}  List of configured ZVEI units.
 */
export async function get_zvei() {

    let sql = `
    SELECT *
    FROM ZVEI
    `;
    let rows = await sql_query(sql, []);
    return rows;
}

/**
 * Get the ZVEI description.
 * @param {number} zvei_id ID of the ZVEI unit.
 * @returns {Promise<string>} The ZVEI description or "".
 */
export async function get_zvei_details(zvei_id) {
    //let zvei_id = parseInt(zvei_id_);
    if (!is_zvei_safe(zvei_id)) {
        return "";
    }

    let sql = `
        SELECT description
        FROM ZVEI
        WHERE zvei_id = ?
    `;
    let params = [zvei_id];
    let rows = await sql_query(sql, params);
    if (rows.length != 1) {
        return "";
    } else {
        return rows[0].description;
    }
}

/**
 * Adds a ZVEI unit.
 * @param {number} zvei_id ID of the ZVEI unit.
 * @param {string} description Description of the ZVEI unit.
 * @param {number} test_day Day of the week of the test alarm (Sunday = 0 , Monday = 1, ...).
 * @param {string} test_time_start Start time of the test alarm window (format: HH:MM).
 * @param {string} test_time_end End time of the test alarm window (format: HH:MM).
 * @return {Promise<boolean>} Success
 */
export async function add_zvei(zvei_id, description, test_day, test_time_start, test_time_end) {

    //let zvei_id = parseInt(zvei_id_);
    //let test_day = parseInt(test_day_);

    if (!is_zvei_safe(zvei_id) || !is_text_safe(description) || !is_time_safe(test_time_start) || !is_time_safe(test_time_end) || !(test_day >= 0 && test_day <7)) {
        return false;
    }

    let sql = `
    INSERT INTO ZVEI(zvei_id, description, test_day, test_time_start, test_time_end)
    VALUES (?, ?, ?, ?, ?)
    `;
    let params = [zvei_id, description, test_day, test_time_start, test_time_end];
    return await sql_run(sql, params);
}

/**
 * Removes a ZVEI unit.
 * @param {number} zvei_id ID of the ZVEI unit to be removed.
 * @returns {Promise<boolean>} success
 */
export async function remove_zvei(zvei_id) {
    //let zvei_id = parseInt(zvei_id_);
    if (!is_zvei_safe(zvei_id)) {
        return false;
    }

    let sql = `
    DELETE FROM ZVEI
    WHERE zvei_id = ?
    `;
    let params = [zvei_id];
    await sql_run(sql, params);

    // 2. Remove all linked alarms.
    let sql2 = `
    DELETE FROM Alarms
    WHERE zvei_id = ?
    `
    return await sql_run(sql2, params);
}

/**
 * Empties all obsolete entries from the AlertHistory table. This should be performed before every table query.
 * @returns {Promise<boolean>} Success
 */
async function clear_history() {
    let sql = `
    DELETE FROM AlarmHistory
    WHERE timestamp < ?
    `;
    let reference = Date.now() - HISTORY_TIMEOUT_MS;

    let params = [reference];
    return await sql_run(sql, params);
}

/**
 * Check if an alarm for the provided zvei was received within the grace period defined in config.json.
 * An alert should not be sent if it is a repeat alarm.
 * @param {number} zvei_id ID of the ZVEI unit to check for double alarm.
 * @returns {Promise<boolean>} Wether the alarm should be suppressed.
 */
export async function is_repeat_alarm(zvei_id) {

    //let zvei_id = parseInt(zvei_id_);
    if (!is_zvei_safe(zvei_id)) {
        return false;
    }

    //first clean history entries
    let res = await clear_history();
    if (!res) {
        return false;
    }

    let sql = `
        SELECT COUNT(zvei_id)
        FROM AlarmHistory
        WHERE zvei_id = ?
        `
    let params = [zvei_id];

    let result = await sql_query(sql, params);
    let val = result[0]["COUNT(zvei_id)"];
    return val > 0;
}

/**
 * Add an alarm for the provided ZVEI to the history DB for double alert detection.
 * @param {number} zvei_id ID of the ZVEI unit for which the alert was received.
 * @param {number} timestamp The point in Unix time when the alarm was received by the interface.
 * @param {number} information_content An integer representing the alarms information content. Depends on interfacae device.
 * @returns {Promise<boolean>} Success
 */
export async function add_alarm_history(zvei_id, timestamp, information_content) {

    //let zvei_id = parseInt(zvei_id_);

    if (!is_zvei_safe(zvei_id) || !is_numeric_safe(timestamp) || !is_numeric_safe(information_content)) {
        return false;
    }

    let sql = `
    INSERT INTO AlarmHistory(zvei_id, timestamp, alert_level)
    VALUES (?, ?, ?)
    `;

    let params = [zvei_id, timestamp, information_content];
    return await sql_run(sql, params);
}

/**
 * Check if the information level of a double alarm is higher than the previous alarm (f.e. SMS after ZVEI). In this case send new information as new alarm ONLY to Telegram
 * (not FCM/APNS). This can possibly happen minutes after initial alarm. The relevant grace period is set in config.json.
 * @param {number} zvei_id ID of the ZVEI unit to check for information update.
 * @param {number} information_content An INFORMATION_CONTENT representing the new alerts source.
 * @returns {Promise<boolean>} Wether this alert probably contains new information.
 */
export async function is_alarm_information_update(zvei_id, information_content) {

    //let zvei_id = parseInt(zvei_id_);

    if (!is_zvei_safe(zvei_id) || !is_numeric_safe(information_content)) {
        return false;
    }

    let sql = `
    SELECT COUNT(zvei_id)
    FROM AlarmHistory
    WHERE zvei_id = ? AND alert_level >= ?
    `

    let params = [zvei_id, information_content];
    let result = await sql_query(sql, params);

    let val = result[0]["COUNT(zvei_id)"];
    return val == 0;
}

/**
 * Get the complete group table.
 * @returns {Promise<Array<{group_id: number, description: string, chat_id: string, auth_token: string}>>}
 */
export async function get_groups() {

    let sql = `
     SELECT *
     FROM Groups
     `;
    let rows = await sql_query(sql, []);
    return rows;
}

/**
 * Return all information for a group.
 * @param {number} group_id ID of group to query.
 * @returns {Promise<Array<{group_id: number, description: string, chat_id: string, auth_token: string}>>} Full DB entry for group.
 */
export async function get_group_details(group_id) {
    //let group_id = parseInt(group_id_);
    if (!is_numeric_safe(group_id)) {
        return [];
    }

    let sql = `
        SELECT *
        FROM GROUPS
        WHERE group_id = ?
    `;
    let params = [group_id];
    let rows = await sql_query(sql, params);
    return rows;
}

/**
 * Return a list of ZVEIs (id and descriptor) that a group is linked to.
 * @param {number} group_id ID of group to query,
 * @returns {Promise<Array<{zvei_id: number, description: string}>>} A list of linked alarms.
 */
export async function get_group_alarms(group_id) {


    //let group_id = parseInt(group_id_);
    if (!is_numeric_safe(group_id) || group_id == -1) {
        return [];
    }

    let sql = `
        SELECT ZVEI.zvei_id, ZVEI.description
        FROM ZVEI
        JOIN Alarms on ZVEI.zvei_id = Alarms.zvei_id
        WHERE Alarms.group_id = ?
        ORDER BY ZVEI.zvei_id
    `;
    let params = [group_id];
    let rows = await sql_query(sql, params);
    return rows;
}

/**
 * Add a group.
 * Hint: The group ID is an auto-increment column, so an ID is automatically assigned to the new group.
 * @param {string} description description of the group to be created.
 * @returns {Promise<string>} The authentication token.
 */
export async function add_group(description) {


    if (!is_text_safe(description)) {
        return "";
    }

    let auth_token = hat(40, 16);
    let sql = `
    INSERT INTO Groups(description, auth_token)
    VALUES (?, ?)
    `;
    let params = [description, auth_token];
    let res = await sql_run(sql, params);
    if (!res) {
        return "";
    }
    return auth_token;
}

/**
 * Authenticates a group.
 * Explanation: When a new group is added, an authentication token is generated and communicated to the group.
 * If the authentication is then sent to the Telegram bot within the group, the group is authenticated and the chat ID is added in the database.
 * @param {number} chat_id chat ID of the group.
 * @param {string} auth_token authentication token generated when the group was added.
 * @returns {Promise<number>} The group ID if authenticated. -1 otherwise.
 */
export async function authenticate_group(chat_id, auth_token) {

    if (!is_chat_id_safe(chat_id) || !is_auth_token_safe(auth_token)) {
        return -1;
    }

    let sqlCheck = `
    SELECT group_id
    FROM Groups
    WHERE auth_token = ?
    LIMIT 1
    `;

    let groupID = await sql_query(sqlCheck, [auth_token]);
    if (groupID.length < 1) {
        log.debug("Invalid authentication code.");
        return -1;
    }

    let sqlSingleChatCheck = `
    SELECT group_id
    FROM Groups
    WHERE chat_id = ?
    LIMIT 1
    `;

    let existCheck = await sql_query(sqlSingleChatCheck, [chat_id.toString()]);
    if (existCheck.length > 0) {
        log.debug("Cannot authenticate group as chat id already registered.");
        return -1;
    }

    let sql = `
    UPDATE Groups
    SET chat_id = ?, auth_token = NULL
    WHERE auth_token = ?
    `;
    let params = [chat_id.toString(), auth_token];
    let res = await sql_run(sql, params);
    if (!res) {
        return -1;
    }

    return groupID[0].group_id;
}

/**
 * Updates a group.
 * @param {number} group_id group ID of group to be updated.
 * @param {string} description new description of the group.
 * @returns {Promise<boolean>} Success
 */
export async function update_group(group_id, description) {

    //let group_id = parseInt(group_id_);

    if (!is_numeric_safe(group_id) || !is_text_safe(description)) {
        return false;
    }

    let sql = `
    UPDATE Groups
    SET description = ? 
    WHERE group_id = ?
    `;
    let params = [description, group_id];
    return await sql_run(sql, params);
}

/**
 * Removes a group and all linked alarms.
 * @param {number} group_id group ID of the group to be removed.
 * @returns {Promise<boolean>} Success
 */
export async function remove_group(group_id) {

    //let group_id = parseInt(group_id_);

    // 1. Check if group ID is safe
    if (!is_numeric_safe(group_id)) {
        return false;
    }

    // 2. Delete Group from Groups
    let sql = `
    DELETE FROM Groups
    WHERE group_id = ?
    `;
    let params = [group_id];
    let res = await sql_run(sql, params);

    if (!res) {
        return false;
    }

    // 3. Delete all linked alarms.
    sql = `
    DELETE FROM Alarms
    WHERE group_id = ?
    `;
    return await sql_run(sql, params);
}

/**
 * Adds an alarm link between a ZVEI unit and a group.
 * Example: add_alarm(25977, 4) links the ZVEI ID 25977 to the group with ID 4 ("B1").
 * @param {number} zvei_id ID of the ZVEI unit.
 * @param {number} group_id ID of the group.
 * @returns {Promise<boolean>} Success
 */
export async function add_alarm(zvei_id, group_id) {

    //let zvei_id = parseInt(zvei_id_);
    //let group_id = parseInt(group_id_);

    if (!is_zvei_safe(zvei_id) || !is_numeric_safe(group_id)) {
        return false;
    }

    let sql = `
    INSERT INTO Alarms(zvei_id, group_id)
    VALUES (?, ?)
    `;
    let params = [zvei_id, group_id];
    return await sql_run(sql, params);
}
/**
 * Removes an alarm link between a ZVEI unit and a group.
 * @param {number} zvei_id ID of the ZVEI unit.
 * @param {number} group_id ID of the group.
 * @returns {Promise<boolean>} Success
 */
export async function remove_alarm(zvei_id, group_id) {


    //let zvei_id = parseInt(zvei_id_);
    //let group_id = parseInt(group_id_);

    if (!is_zvei_safe(zvei_id) || !is_numeric_safe(group_id)) {
        return false;
    }

    let sql = `
    DELETE FROM Alarms
    WHERE zvei_id = ? AND group_id = ?
    `
    let params = [zvei_id, group_id];
    return await sql_run(sql, params);
}

/**
 * Gets the corresponding group ID from a chat ID.
 * @param {number} chat_id Chat ID.
 * @returns {Promise<number>} Group ID.
 */
export async function get_group_id_from_chat_id(chat_id) {

    if (!is_chat_id_safe(chat_id)) {
        return -1;
    }
    let sql = `
    SELECT group_id
    FROM Groups
    WHERE chat_id = ?
    LIMIT 1
    `;
    let group_id = await sql_query(sql, [chat_id.toString()]);
    if (group_id.length < 1) {
        // No group found with specified chat ID
        log.debug("Invalid chat ID.");
        return -1;
    }

    return group_id[0].group_id;
}

/**
 * Adds or updates a user.
 * @param {number} user_id User ID.
 * @param {string} token FCM/APNS token.
 * @returns {Promise<boolean>} Success
 */
export async function update_user(user_id, token) {

    //let user_id = parseInt(user_id_);

    if (!is_numeric_safe(user_id) || !is_device_token_safe(token)) {
        return false;
    }

    let sql = `
    REPLACE INTO Users(user_id, token, token_type)
    VALUES(?, ?, "ANY")
    `;
    const params = [user_id, token];

    return await sql_run(sql, params);
}

/**
* Links a user to an alarm by adding a new entry in UserGroups.
* @param {number} user_id User ID.
* @param {number} group_id Group ID.
* @returns {Promise<boolean>} Success
*/
export async function add_user_group(user_id, group_id) {


    //let user_id = parseInt(user_id_);
    //let group_id = parseInt(group_id_);
    if (!is_numeric_safe(user_id) || !is_numeric_safe(group_id)) {
        return false;
    }
    let sql = `
    REPLACE INTO UserGroups(user_id, group_id)
    VALUES(?, ?)
    `;
    let params = [user_id, group_id];
    return await sql_run(sql, params);
}

/**
    * Deletes a group from the subscribed alerts for a user.
    * @param {number} user_id User ID.
    * @param {number} group_id Group ID.
    * @returns {Promise<boolean>} Success
    */

export async function remove_user_link(user_id, group_id) {

    //let user_id = parseInt(user_id_);
    //let group_id = parseInt(group_id_);

    if (!is_numeric_safe(user_id) || !is_numeric_safe(group_id)) {
        return false;
    }

    let sql = `
        DELETE FROM UserGroups
        WHERE user_id = ? AND group_id = ?
    `;
    let params = [user_id, group_id];
    return await sql_run(sql, params);
}

/**
 * Get all chatIDs linked to the user, if any.
 * @param {number} user_id User ID (Telergam).
 * @returns {Promise<Array<number>>} Array of chatIDs. Can be empty.
 */
export async function user_chat_ids(user_id) {


    //let user_id = parseInt(user_id_);
    if (!is_numeric_safe(user_id)) {
        return [];
    }

    let sql = `
         SELECT Groups.chat_id
         FROM Users
         JOIN UserGroups ON Users.user_id = UserGroups.user_id
         JOIN Groups ON UserGroups.group_id = Groups.group_id
         WHERE Users.user_id = ? AND UserGroups.group_id IS NOT NULL
     `;
    let rows = await sql_query(sql, [user_id]);

    let chat_ids = [];
    for (let index in rows) {
        chat_ids.push(parseInt(rows[index].chat_id));
    }
    return chat_ids;
}

/**
 * Get the user device token if at least one valid subscription is present.
 * Used for alert tests.
 * @param {number} user_id User ID.
 * @returns {Promise<string>}: The FCM device token as string.
 */
export async function user_token(user_id) {
    //let user_id = parseInt(user_id_);
    if (!is_numeric_safe(user_id)) {
        return "";
    }

    let sql = `
        SELECT token
        FROM Users
        JOIN UserGroups ON Users.user_id = UserGroups.user_id
        WHERE Users.user_id = ? AND UserGroups.group_id IS NOT NULL
        LIMIT 1
    `;
    let rows = await sql_query(sql, [user_id]);
    if (rows.length < 1) {
        return "";
    }
    return rows[0].token;
}

/**
 * Deletes the user entry from database and all connected alerts.
 * @param {number} user_id User ID.
 * @returns {Promise<boolean>} Success
 */
export async function remove_user(user_id) {
    //let user_id = parseInt(user_id_);

    if (!is_numeric_safe(user_id)) {
        return false;
    }

    let sql = `
        DELETE FROM Users
        WHERE user_id = ?
    `;

    let params = [user_id];
    sql_run(sql, params);

    let sql2 = `
        DELETE FROM UserGroups
        WHERE user_id = ?
    `;

    return await sql_run(sql2, params);
}

/**
 * Initialises database connection. Should be called on startup.
 * @returns {Promise<boolean>} Promise to await initialisation complete.
 */
export function connect_database() {


    if (!fs.existsSync(DB_PATH)) {
        log.error("Database file was not found. This is a fatal error!");
        log.debug("Database location: " + path.resolve(DB_PATH));
        return Promise.reject(false);
    }

    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (/**@type {any} */ err) => {
            if (err) {
                log.error(err.message);
                log.error("Could not connect to database. This is a fatal error!");
                reject(false);
            } else {
                log.debug(`Connected to the database in file ${DB_PATH}.`);
                resolve(true);
            }
        });
    });
}

export function close_database() {
    /**
     * Cleanly closes database, if initialised.
     */
    if (db != null) {
        db.close();
    }
}



