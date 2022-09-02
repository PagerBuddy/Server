import sqlite3 from 'sqlite3';
import logger from './logging.mjs'
import { existsSync } from 'fs'
import ZVEI from './model/zvei.mjs'
import Optional from 'optional-js'
import { Group } from './model/group.mjs';
import { User } from './model/user.mjs'
import * as validator from './model/validation.mjs'
import hat from 'hat';

export class database {
    /**
     * 
     * @param {string} timezone 
     * @param {number} history_timeout 
     * @param {sqlite3.Database} db The sqlite3 database object
     * @param {boolean} trace Whether the issued SQL queries are printed to the console. Defaults to `false`
     * @return
     */
    constructor(timezone, history_timeout, db, trace = false) {
        this.timezone = timezone;
        this.history_timeout = history_timeout;
        this.logger = logger("DBClass");
        this.db = db;
        this.#sql_run("PRAGMA foreign_keys = ON;", []);
        if (trace) {
            this.db.on('trace', function (item) {
                console.log('TRACE: ', item);
            });
            sqlite3.verbose();
        }

    }

    /**
     * Closes the database
     */
    close() {
        this.db.close();
    }

    /** 
     * Executes an SQL query with the given parameters returning whether the query succeeded
     * @param {string} sql SQL query to be executed.
     * @param {Array<string|number>} params list of parameters.
     * @returns {Promise<boolean>} True iff the sql query succeeded
    */
    #sql_run(sql, params) {

        return new Promise((resolve, _) => {
            this.db.all(sql, params, (/** @type {any} */err, /** @type {any} */rows) => {
                if (err) {
                    this.logger.error(err.message);
                    this.logger.error("An error occured trying to perform a query.");
                    resolve(false);
                } else {
                    resolve(true);
                }
            })
        })
    }


    /** 
     * Executes an SQL query with the given parameters und returns the results
     * @param {string} sql SQL query to be executed.
     * @param {Array<string|number>} params list of parameters.
     * @returns {Promise<Array<Object.<String,String|number>>>} result rows.
    */
    #sql_query(sql, params) {

        // log.debug("Query: " + sql + "; Params: " + params);
        return new Promise((resolve, _) => {
            try {
                this.db.all(sql, params, (/** @type {any} */err, /** @type {any} */rows) => {
                    if (err) {
                        this.logger.error(err.message);
                        this.logger.error("An error occured trying to perform a query.");
                        resolve([]);
                    } else {
                        resolve(rows);
                    }
                })
            } catch (/**@type {any} */ error) {
                this.logger.error(error.message);
                this.logger.error("An error occured trying to perform a query.");
                resolve([]);
            }
        })
    }

    /**
     * Transforms a row of the Groups database table to a {@see Group}
     * 
     * This is just a tiny convenience function
     * @param {{group_id: number, description: string, chat_id: string, auth_token:string}} row 
     * @returns {Group}
     */
    #row_to_group(row) {
        return new Group(row.group_id, row.description, parseInt(row.chat_id), row.auth_token);
    }

    /**
     * Transforms the result set of the Groups database table into an array of {@see Group}s
     * 
     * This is just a tiny convenience function
     * @param {Array<{group_id: number, description: string, chat_id: string, auth_token:string}>} rows 
     * @returns {Array<Group>}
     */
    #rows_to_groups(rows) {
        return rows.map(r => { return this.#row_to_group(r); });
    }

    /**
     * Check is an auth token is already in use
     * @param {String} auth_token 
     * @returns {Promise<Boolean>} True iff the auth token is already in use
     */
    async #auth_token_exists(auth_token) {
        const sql = `
            SELECT * 
            FROM Groups
            WHERE auth_token = ?
            `;
        const params = [auth_token];
        const rows = await this.#sql_query(sql, params);
        if (rows.length > 0) {
            return true;
        }
        else {
            return false;
        }
    }

    /**
     * Get the complete group table.
     * @returns {Promise<Group[]>}
     */
    async get_groups() {

        const sql = `
     SELECT *
     FROM Groups
     `;
        const rows = this.#sql_query(sql, []);
        const groups = rows.then(rws => { return this.#rows_to_groups(rws) })
        return groups;
    }

    /**
      * Lookup a group based on its ID
      * @param {number} group_id ID of group to query.
      * @returns {Promise<Optional<Group>>} The looked up group if present
      */
    async get_group(group_id) {
        //let group_id = parseInt(group_id_);
        if (!validator.is_numeric_safe(group_id)) {
            return Optional.empty()
        };

        let sql = `
        SELECT *
        FROM GROUPS
        WHERE group_id = ?
    `;
        const params = [group_id];
        /**@type {{group_id: number, description: string, chat_id: string, auth_token: string}[]}   */
        const rows = await this.#sql_query(sql, params);
        if (rows.length != 1) {
            return Optional.empty()
        }
        else {
            const r = rows[0];
            return Optional.of(this.#row_to_group(r));
        }
    }


    /**
     * Returns a list of the ZVEIs that the provided group is linked to.
     * 
     * The result is ordered by the ZVEI ID.
     * @param {number} group_id 
     * @returns {Promise<ZVEI[]>}
     */
    async get_group_zveis(group_id) {
        if (!validator.is_numeric_safe(group_id) || group_id == -1) {
            return [];
        }
        const sql = `
        SELECT *
        FROM ZVEI
        JOIN Alarms on ZVEI.zvei_id = Alarms.zvei_id
        WHERE Alarms.group_id = ?
        ORDER BY ZVEI.zvei_id
    `;
        const params = [group_id];
        const rows = await this.#sql_query(sql, params);
        const result = this.#rows_to_zveis(rows);
        return result;
    }

    /**
     * Add a group
     * @param {string} description description of the group to be added
     * @returns {Promise<Optional<Group>>} Group object with a freshly generated auth token (if addition was successfull), `Optional.empty()` otherwise
     */
    async add_group(description) {


        if (!validator.is_text_safe(description)) {
            return Optional.empty();
        }

        let token_exists = true;
        let auth_token = ""
        do {
            auth_token = hat(40, 16);
            token_exists = await this.#auth_token_exists(auth_token)
        } while (token_exists)

        const sql = `
    INSERT INTO Groups(description, auth_token)
    VALUES (?, ?)
    `;
        const params = [description, auth_token];
        return new Promise((resolve, _) => {
            this.db.run(sql, params, function (/** @type {any} */error) {
                if (error) {
                    resolve(Optional.empty());
                }
                else {
                    /**
                    * @type {Group}
                    */
                    const g = new Group(this.lastID, description, null, auth_token);
                    resolve(Optional.of(g));
                }
            });
        })
    }

    /**
     * Updates/changes the description of a group
     * @param {number} group_id group ID of group to be updated.
     * @param {string} description new description of the group.
     * @returns {Promise<boolean>} Success
     */
    async update_group_description(group_id, description) {

        //let group_id = parseInt(group_id_);

        if (!validator.is_numeric_safe(group_id) || !validator.is_text_safe(description)) {
            return false;
        }

        let sql = `
    UPDATE Groups
    SET description = ? 
    WHERE group_id = ?
    `;
        let params = [description, group_id];
        return this.#sql_run(sql, params);
    }

    /**
     * Removes a group and all linked alarms.
     * @param {Group} group group ID of the group to be removed.
     * @returns {Promise<boolean>} Success
     */
    async remove_group(group) {

        const group_id = group.id

        // 1. Check if group ID is safe
        if (!validator.is_numeric_safe(group_id)) {
            return false;
        }

        // 2. Delete Group from Groups
        const sql_delete_group = `
        DELETE FROM Groups
        WHERE group_id = ?
        `;

        const params = [group_id];

        return this.#sql_run(sql_delete_group, params);

    }


    /**
     * Authenticates a group (identified by its auth token) to a Telegram group (identified by its chat id).
     * 
     * Explanation: When a new group is added, an authentication token is generated and communicated to the group.
     * If the authentication is then sent to the Telegram bot within the group, the group is authenticated and the chat ID is added in the database.
     * 
     * @param {number} chat_id chat ID of the group.
     * @param {string} auth_token authentication token generated when the group was added.
     * @returns {Promise<Optional<Group>>} The group that was authenticated, empty optional if no group was authenticated
     */
    async authenticate_group(chat_id, auth_token) {

        if (!validator.is_chat_id_safe(chat_id)) {
            this.logger.warn(`"${chat_id}" is not a valid chat id`);
            return Optional.empty();
        }
        if (!Group.is_auth_token_safe(auth_token)) {
            this.logger.warn(`"${auth_token}" is not a valid auth token`);
            return Optional.empty();
        }

        let sqlCheck = `
    SELECT group_id
    FROM Groups
    WHERE auth_token = ?
    `;

        let group_id = -1
        /**@type {{group_id: number}[]} */
        const group_res = await this.#sql_query(sqlCheck, [auth_token]);

        if (group_res.length != 1) {
            this.logger.warn(`Auth token "${auth_token}" has ${group_res.length} associated groups (must be exactly 1)`);
            return Optional.empty();
        }
        else {
            group_id = group_res[0].group_id;
        }

        let sqlSingleChatCheck = `
    SELECT group_id
    FROM Groups
    WHERE chat_id = ?
    LIMIT 1
    `;

        let existCheck = await this.#sql_query(sqlSingleChatCheck, [chat_id.toString()]);
        if (existCheck.length > 0) {
            this.logger.warn(`Cannot authenticate group using auth token "${auth_token}" for chat id "${chat_id}": chat id already registered to groups "{${existCheck}}"`);
            return Optional.empty();
        }

        let sql = `
    UPDATE Groups
    SET chat_id = ?, auth_token = NULL
    WHERE auth_token = ?
    `;
        let params = [chat_id.toString(), auth_token];
        let res = await this.#sql_run(sql, params);
        if (!res) {
            return Optional.empty();
        }

        // return the updated group
        return this.get_group(group_id)
    }

    /**
 * Gets the corresponding group ID from a chat ID.
 * @param {number} chat_id Chat ID.
 * @returns {Promise<Optional<Group>>} Group ID.
 */
    async get_group_from_chat_id(chat_id) {

        if (!validator.is_chat_id_safe(chat_id)) {
            return Optional.empty()
        }
        let sql = `
    SELECT *
    FROM Groups
    WHERE chat_id = ?
    LIMIT 1
    `;
        let res = await this.#sql_query(sql, [chat_id.toString()]);
        if (res.length != 1) {
            // No group found with specified chat ID
            this.logger.debug("Invalid chat ID.");
            return Optional.empty();
        }

        return Optional.of(this.#row_to_group(res[0]));
    }

    /**
     * Transforms a row of the ZVEI database table to a {@see Z.ZVEI}
     * 
     * This is just a tiny convenience function
     * @param {{zvei_id: number, description: string, test_day: number, test_time_start:string, test_time_end:string }} row 
     * @returns {ZVEI}
     */
    #row_to_zvei(row) {
        return new ZVEI(row.zvei_id, row.description,
            row.test_day, row.test_time_start, row.test_time_end);
    }

    /**
     * Transforms the result set of the Groups database table into an array of {@see Z.ZVEI}s
     * 
     * This is just a tiny convenience function
     * @param {Array<{zvei_id: number, description: string, test_day: number, test_time_start:string, test_time_end:string }>} rows 
     * @returns {Array<ZVEI>}
     */
    #rows_to_zveis(rows) {
        return rows.map(r => { return this.#row_to_zvei(r); });
    }

    /**
     * Returns all ZVEI units
     * @returns {Promise<ZVEI[]>}
     */
    get_ZVEIs() {
        let sql = `
        SELECT *
        FROM ZVEI
        `;

        const rows = this.#sql_query(sql, []);
        const zveis = rows.then(rws => { return this.#rows_to_zveis(rws); });
        return zveis;
    }

    /**
     * Returns the ZVEI for a given ZVEI ID.
     * @param {string|number} zvei_id 
     * @returns {Promise<Optional<ZVEI>>}
     */
    async get_ZVEI(zvei_id) {

        if (!ZVEI.is_valid_id(zvei_id)) {
            throw new Error(`Invalid ZVEI ID provided: ${zvei_id}`);
        }

        const sql = `
        SELECT *
        FROM ZVEI
        WHERE zvei_id = ?
        `;

        let params = [zvei_id];
        let rows = await this.#sql_query(sql, params);
        if (rows.length != 1) {
            return Optional.empty();
        } else {
            const r = rows[0];
            return Optional.of(this.#row_to_zvei(r));
        }
    }


    /**
     * Get the ZVEI description.
     * @param {string|number} zvei_id ID of the ZVEI unit.
     * @returns {Promise<Optional<String>>} The ZVEI description (if the ZVEI exists)
     */
    async get_ZVEI_details(zvei_id) {

        const zvei = await this.get_ZVEI(zvei_id);

        if (zvei.isPresent()) {
            return Optional.of(zvei.get().description);
        }
        else { // this is necessary as Optional<ZVEI>.empty() != Optional<String>.empty()
            return Optional.empty();
        }
    }

    /**
     * 
     * @param {ZVEI} zvei 
     * @returns {Promise<boolean>}
     */
    async add_ZVEI(zvei) {
        let sql = `
            INSERT INTO ZVEI(zvei_id, description, test_day, test_time_start, test_time_end)
            VALUES (?, ?, ?, ?, ?)
            `;
        let params = [zvei.id, zvei.description, zvei.test_day, zvei.test_time_start, zvei.test_time_end];
        return this.#sql_run(sql, params);
    }

    /**
     * Removes a given ZVEI and all alarms for the ZVEI from the database
     * @param {ZVEI} zvei 
     * @returns {Promise<boolean>} Whether the deletion succeeded
     */
    async remove_ZVEI(zvei) {

        const params = [zvei.id];

        const sql_delete_zvei = `
            DELETE FROM ZVEI
            WHERE zvei_id = ?
            `;

        return this.#sql_run(sql_delete_zvei, params);
    }

    /**
     * Adds an alarm link between a ZVEI unit and a group.
     * Example: add_alarm(25977, 4) links the ZVEI ID 25977 to the group with ID 4 ("B1").
     * @param {ZVEI} zvei
     * @param {number} group_id ID of the group.
     * @returns {Promise<boolean>} Success
     */
    async link_zvei_with_group(zvei, group_id) {
        return this.link_zvei_with_group_id(zvei.id, group_id);
    }

    /**
     * Adds an alarm link between a ZVEI unit and a group.
     * Example: add_alarm(25977, 4) links the ZVEI ID 25977 to the group with ID 4 ("B1").
     * @param {number} zvei_id
     * @param {number} group_id ID of the group.
     * @returns {Promise<boolean>} Success
     */
    async link_zvei_with_group_id(zvei_id, group_id) {
        if (!validator.is_numeric_safe(group_id)) {
            console.log("invalid")
            return false;
        }

        let sql = `
            INSERT INTO Alarms(zvei_id, group_id)
            VALUES (?, ?)
            `;
        let params = [zvei_id, group_id];

        return await this.#sql_run(sql, params);
    }

    /**
     * Removes an alarm link between a ZVEI unit and a group.
     * @param {ZVEI} zvei
     * @param {number} group_id ID of the group.
     * @returns {Promise<boolean>} Success
     */
    async unlink_zvei_and_group(zvei, group_id) {
        return this.unlink_zvei_and_group_id(zvei.id, group_id);
    }

    /**
     * Removes an alarm link between a ZVEI unit and a group.
     * @param {number} zvei_id
     * @param {number} group_id ID of the group.
     * @returns {Promise<boolean>} Success
     */
    async unlink_zvei_and_group_id(zvei_id, group_id) {

        if (!validator.is_numeric_safe(group_id)) {
            return false;
        }

        let sql = `
            DELETE FROM Alarms
            WHERE zvei_id = ? AND group_id = ?
            `
        let params = [zvei_id, group_id];
        return await this.#sql_run(sql, params);
    }


    /**
     * Returns the chat_ids linked to a given ZVEI unit.
     * @param {number} zvei_id
     * @returns {Promise<number[]>}  list of chat IDs linked to the ZVEI unit.
     */
    async get_chat_ids_from_zvei_by_id(zvei_id) {
        let sql = `
        SELECT Groups.chat_id
        FROM Alarms
        JOIN Groups ON Alarms.group_id = Groups.group_id
        JOIN ZVEI ON Alarms.zvei_id = ZVEI.zvei_id
        WHERE ZVEI.zvei_id = ?
        `;
        let params = [zvei_id];
        let rows = await this.#sql_query(sql, params);

        let chat_ids = [];
        for (let index in rows) {
            chat_ids.push(parseInt(rows[index].chat_id));
        }
        return chat_ids;
    }

    /**
     * Returns the chat_ids linked to a given ZVEI unit.
     * @param {ZVEI} zvei
     * @returns {Promise<number[]>}  list of chat IDs linked to the ZVEI unit.
     */
    async get_chat_ids_from_zvei(zvei) {
        return await this.get_chat_ids_from_zvei_by_id(zvei.id);
    }

    /**
     * Replaces a group chat id.
     * @param {number} current_chat_id Old id to be replaced.
     * @param {number} new_chat_id New id.
     */
    async replace_chat_id(current_chat_id, new_chat_id) {
        if (!validator.is_chat_id_safe(current_chat_id) || !validator.is_chat_id_safe(new_chat_id)) {
            return false;
        }

        const sql = `
        UPDATE Groups
        SET chat_id = ?
        WHERE chat_id = ?
        `;

        const params = [new_chat_id.toString(), current_chat_id.toString()];
        return await this.#sql_run(sql, params);
    }


    /**
     * Gets the list of alarm subscriptions for FCM.
     * @returns {Promise<Array<{user_id: number, group_id: number, chat_id: string, token: string}>>} An array of alert subscriptions [[user_id, group_id, chat_id]].
     */
    async get_check_users_list() {

        // TODO return User/Group objects instead of generic object
        let sql = `
        SELECT UserGroups.user_id, UserGroups.group_id, Groups.chat_id, Users.token
        FROM Groups
        JOIN UserGroups ON Groups.group_id = UserGroups.group_id
        JOIN Users ON UserGroups.user_id = Users.user_id
    `;

        let rows = await this.#sql_query(sql, []);
        return rows;
    }

    /**
     * Convenience function for creating users from a sql query row
     * @param {{user_id: number, token: string, token_type: string}} row 
     * @returns {User}
     */
    #row_to_user(row) {
        return new User(row.user_id, row.token, row.token_type)
    }

    /**
     * Returns the user object for a given user ID.
     * @param {number} user_id 
     * @returns {Promise<Optional<User>>}
     */
    async get_user(user_id) {
        const sql = `SELECT * FROM Users WHERE user_id = ?`;
        const params = [user_id];
        const res = await this.#sql_query(sql, params);
        if (res.length != 1) {
            return Optional.empty();
        }
        const user = this.#row_to_user(res[0]);
        return Optional.of(user);
    }

    /**
     * Get the user device token if at least one valid subscription is present.
     * Used for alert tests.
     * @param {number} user_id User ID.
     * @returns {Promise<Optional<string>>}: The FCM device token as string.
     */
    async user_token(user_id) {

        if (!validator.is_numeric_safe(user_id)) {
            return Optional.empty();
        }

        let sql = `
        SELECT token
        FROM Users
        JOIN UserGroups ON Users.user_id = UserGroups.user_id
        WHERE Users.user_id = ? AND UserGroups.group_id IS NOT NULL
        LIMIT 1
    `;
        let rows = await this.#sql_query(sql, [user_id]);
        if (rows.length < 1) {
            return Optional.empty();
        }
        return Optional.of(rows[0].token);
    }

    /**
     * Adds or updates a user.
     * @param {number} user_id User ID.
     * @param {string} token FCM/APNS token.
     * @returns {Promise<Optional<User>>} Success
     */
    async update_user(user_id, token) {

        if (!validator.is_numeric_safe(user_id) || !User.is_device_token_safe(token)) {
            return Optional.empty();
        }

        let sql = `
    REPLACE INTO Users(user_id, token, token_type)
    VALUES(?, ?, "ANY")
    `;
        const params = [user_id, token];

        const res = await this.#sql_run(sql, params);

        if (res) {
            return Optional.of(new User(user_id, token, "ANY"));
        }
        else {
            return Optional.empty();
        }
    }

    /**
     * Deletes the user entry from database and all connected alerts.
     * @param {User} user User ID.
     * @returns {Promise<boolean>} Success
     */
    async remove_user(user) {

        if (!validator.is_numeric_safe(user.id)) {
            return false;
        }

        let sql = `
        DELETE FROM Users
        WHERE user_id = ?
        `;


        let params = [user.id];
        return await this.#sql_run(sql, params);
    }


    /**
    * Adds a user to a group
    * @param {User} user User ID.
    * @param {Group} group 
    * @returns {Promise<boolean>} Success
    */
    async add_user_to_group(user, group) {

        if (!validator.is_numeric_safe(user.id) || !validator.is_numeric_safe(group.id)) {
            return false;
        }
        let sql = `
        REPLACE INTO UserGroups(user_id, group_id)
        VALUES(?, ?)
        `;
        let params = [user.id, group.id];
        return await this.#sql_run(sql, params);
    }

    /**
    * Deletes a group from the subscribed alerts for a user.
    * @param {number} user_id
    * @param {number} group_id
    * @returns {Promise<boolean>} Success
    */
    async remove_user_from_group_by_ids(user_id, group_id) {

        if (!validator.is_numeric_safe(user_id) || !validator.is_numeric_safe(group_id)) {
            return false;
        }

        let sql = `
        DELETE FROM UserGroups
        WHERE user_id = ? AND group_id = ?
    `;
        let params = [user_id, group_id];
        return await this.#sql_run(sql, params);
    }

    /**
    * Deletes a group from the subscribed alerts for a user.
    * @param {User} user 
    * @param {Group} group
    * @returns {Promise<boolean>} Success
    */
    async remove_user_from_group(user, group) {
        return this.remove_user_from_group_by_ids(user.id, group.id)
    }

    /**
     * Get all chatIDs linked to the user, if any.
     * @param {number} user_id User ID (Telergam).
     * @returns {Promise<Array<number>>} Array of chatIDs. Can be empty.
     */
    async user_chat_ids(user_id) {

        if (!validator.is_numeric_safe(user_id)) {
            return [];
        }

        let sql = `
         SELECT Groups.chat_id
         FROM Users
         JOIN UserGroups ON Users.user_id = UserGroups.user_id
         JOIN Groups ON UserGroups.group_id = Groups.group_id
         WHERE Users.user_id = ? AND UserGroups.group_id IS NOT NULL
     `;
        let rows = await this.#sql_query(sql, [user_id]);

        let chat_ids = [];
        for (let index in rows) {
            chat_ids.push(parseInt(rows[index].chat_id));
        }
        return chat_ids;
    }

    /**
     * Gets the FCM device tokens and chatIDs linked to a given ZVEI unit.
     * @param {ZVEI} zvei
     * @returns {Promise<Array<{token: string, chat_id: string, user_id: number}>>} List of device tokens, chat IDs and user IDs linked to the ZVEI unit.
     */
    async get_device_ids_from_zvei(zvei) {


        //As 10 is special ID for all alerts also get device ids for 10 - mostly relevant to debugging
        let sql = `
        SELECT Users.token, Groups.chat_id, Users.user_id
        FROM Alarms
        JOIN UserGroups ON Alarms.group_id = UserGroups.group_id
        JOIN Users ON UserGroups.user_id = Users.user_id
        Join Groups ON UserGroups.group_id = Groups.group_id
        WHERE Alarms.zvei_id = ? OR Alarms.zvei_id = 10
        `;
        let params = [zvei.id];
        let rows = await this.#sql_query(sql, params);
        return rows;
    }

    /**
     * Removes all obsolete entries from the AlarmHistory table. 
     * This method should be called before every table query.
     * @returns {Promise<boolean>} Success
     */
    async #clear_history() {
        const sql = `
            DELETE FROM AlarmHistory
            WHERE timestamp < ?
            `;
        const reference = Date.now() - this.history_timeout;

        let params = [reference];
        return await this.#sql_run(sql, params);
    }


    /**
     * Check if an alarm for the provided zvei was received within the grace period.
     * 
     * An alert should not be sent if it is a repeat alarm.
     * 
     * @param {ZVEI} zvei The ZVEI unit to check for double alarm.
     * @returns {Promise<boolean>} Wether the alarm should be suppressed.
     */
    async is_repeat_alarm(zvei) {

        //first clean history entries
        let res = await this.#clear_history();
        if (!res) {
            return false;
        }

        let sql = `
        SELECT COUNT(zvei_id)
        FROM AlarmHistory
        WHERE zvei_id = ?
        `
        let params = [zvei.id];

        let result = await this.#sql_query(sql, params);
        let val = result[0]["COUNT(zvei_id)"];
        return val > 0;
    }

    /**
     * Add an alarm for the provided ZVEI to the history DB for double alert detection. TODO does this mean that this is a method for testing purposes only?
     * @param {ZVEI} zvei The ZVEI unit for which the alert was received.
     * @param {number} timestamp The point in Unix time when the alarm was received by the interface.
     * @param {number} information_content An integer representing the alarms information content. Depends on interfacae device.
     * @returns {Promise<boolean>} Success
     */
    async add_alarm_history(zvei, timestamp, information_content) {

        if (!validator.is_numeric_safe(timestamp) ||
            !validator.is_numeric_safe(information_content)) {
            return false;
        }

        let sql = `
    INSERT INTO AlarmHistory(zvei_id, timestamp, alert_level)
    VALUES (?, ?, ?)
    `;

        let params = [zvei.id, timestamp, information_content];
        return await this.#sql_run(sql, params);
    }

    /**
     * Check if the information level of a double alarm is higher than the previous alarm (f.e. SMS after ZVEI). In this case send new information as new alarm ONLY to Telegram
     * (not FCM/APNS). This can possibly happen minutes after initial alarm. The relevant grace period is set in config.json.
     * @param {ZVEI} zvei The ZVEI unit to check for information update.
     * @param {number} information_content An INFORMATION_CONTENT representing the new alerts source.
     * @returns {Promise<boolean>} Wether this alert probably contains new information.
     */
    async is_alarm_information_update(zvei, information_content) {

        if (!validator.is_numeric_safe(information_content)) {
            return false;
        }

        let sql = `
    SELECT COUNT(zvei_id)
    FROM AlarmHistory
    WHERE zvei_id = ? AND alert_level >= ?
    `

        let params = [zvei.id, information_content];
        let result = await this.#sql_query(sql, params);

        let val = result[0]["COUNT(zvei_id)"];
        return val == 0;
    }
}



/**
 * 
 * @param {string} timezone 
 * @param {number} history_timeout 
 * @param {string} db_path The path to the database file
 * @param {boolean} trace If true, print out the SQL queries issued to the database. Defaults to `false`
 * @returns {Promise<database>} 
 */
export async function create_database(timezone, history_timeout, db_path, trace = false) {
    const log = logger("DBClass");

    log.debug(`Connecting to DB in file '${db_path}'`);

    /*
    We manually check for the existence of the file in the db_path parameter as the sqlite3 library
    treats some strings specially in a way that we do not want to support.
    */

    if (!existsSync(db_path)) {
        log.error(`Database file '${db_path}' was not found.`);
        throw new Error(`Could not connect to the database in file '${db_path}'.`);
    }


    const connect_promise = new Promise((resolve, reject) => {
        const db = new sqlite3.Database(db_path, (/** @type {any} */err) => {
            if (err) {
                log.error(`Could not connect to the database in file '${db_path}'.`);
                log.error(err.message);
                throw new Error(`Could not connect to the database in file '${db_path}'.`);
            } else {
                log.debug(`Connected to the database in file '${db_path}'.`);
                resolve(new database(timezone, history_timeout, db, trace));
            }
        });
    });
    return await connect_promise;
}

