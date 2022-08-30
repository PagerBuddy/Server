import sqlite3 from 'sqlite3';
import logger from './logging.mjs'
import { existsSync } from 'fs'
import ZVEI from './model/zvei.mjs'
import Optional from 'optional-js'
import { Group } from './model/group.mjs';
import * as validator from './model/validation.mjs'
import hat from 'hat';
import { resolve } from 'path';

export class database {
    /**
     * 
     * @param {string} timezone 
     * @param {number} history_timeout 
     * @param {sqlite3.Database} db
     * @return
     */
    constructor(timezone, history_timeout, db) {
        this.timezone = timezone;
        this.history_timeout = history_timeout;
        this.logger = logger("DBClass");
        this.db = db;
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
            try{
            this.db.all(sql, params, (/** @type {any} */err, /** @type {any} */rows) => {
                if (err) {
                    this.logger.error(err.message);
                    this.logger.error("An error occured trying to perform a query.");
                    resolve([]);
                } else {
                    resolve(rows);
                }
            })
        }catch(/**@type {any} */ error){
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
     * @returns {Promise<Z.ZVEI[]>}
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
     * Add a group
     *  TODO Why don't we allow to directly add a chat_id in this function? Is this intentional?
     * @param {string} description description of the group to be added
     * @returns {Promise<Optional<Group>>} The authentication token (if addition was successfull), `Optional.empty()` otherwise
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
        // 3. Delete all linked alarms.
        const sql_delete_alarms = `
        DELETE FROM Alarms
        WHERE group_id = ?
        `;

        const params = [group_id];

        /*
        Instead of manually building these chains, we could adopt the general idea from
        https://stackoverflow.com/questions/53299322/transactions-in-node-sqlite3
        but as we plan to move on to a ORM in them medium distant future, it is 
        probably not worth trying to add this
        */

        return new Promise(resolve => {
            this.db.serialize(() => {
                // the second run() should only be executed when the first did not fail
                this.db.run(sql_delete_group, params, (error) => {
                    if (error) {
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                }).run(sql_delete_alarms, params, (error) => {
                    if (error) {
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                });
            });
        });
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
     * Returns the ZVEI for a given ZVEI ID or empty if no ZVEI for the ID exists.
     * @param {string|number} zvei_id 
     * @returns {Promise<Optional<ZVEI>>}
     */
    async get_ZVEI(zvei_id) {


        const id = ZVEI.validate_zvei_id(zvei_id)
        if (!id.isPresent()) {
            throw new Error(`Invalid ZVEI ID provided: ${zvei_id}`);
        }

        const sql = `
        SELECT *
        FROM ZVEI
        WHERE zvei_id = ?
        `;

        let params = [id.get()];
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

        // 2. Remove all linked alarms.
        const sql_delete_alarms = `
        DELETE FROM Alarms
        WHERE zvei_id = ?
        `
        return new Promise(resolve => {
            this.db.serialize(() => {
                // the second run() should only be executed when the first did not fail
                // the doubling of the error callback is probably unnecessary but I can't find
                // any examples on how to use this correctly
                this.db.run(sql_delete_zvei, params, (error) => {
                    if (error) {
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                }).run(sql_delete_alarms, params, (error) => {
                    if (error) {
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    }
                });
            });
        });
    }
}



/**
 * 
 * @param {string} timezone 
 * @param {number} history_timeout 
 * @param {string} db_path 
 * @returns {Promise<database>} 
 */
export async function create_database(timezone, history_timeout, db_path) {
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
                resolve(new database(timezone, history_timeout, db));
            }
        });
    });
    return await connect_promise;
}

