import sqlite3 from 'sqlite3';
import logger from './logging.mjs'
import { existsSync } from 'fs'
import * as Z from './model/zvei.mjs'
import Optional from 'optional-js'
import { Group } from './model/group.mjs';

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
            this.db.all(sql, params, (/** @type {any} */err, /** @type {any} */rows) => {
                if (err) {
                    this.logger.error(err.message);
                    this.logger.error("An error occured trying to perform a query.");
                    resolve([]);
                } else {
                    resolve(rows);
                }
            })
        })
    }

    /**
 * Get the complete group table.
 * @returns {Promise<Group[]>}
 */
    get_groups() {

        let sql = `
     SELECT *
     FROM Groups
     `;
        const rows = this.#sql_query(sql, []);
        const groups = rows.then(res => {
            return res.map(r => {
                return new Group(r.group_id, r.description, r.chat_id, r.auth_token);
            });
        });
        return groups;
    }

    /**
     * Returns all ZVEI units
     * @returns {Promise<Z.ZVEI[]>}
     */
    get_ZVEIs() {
        let sql = `
        SELECT *
        FROM ZVEI
        `;

        const rows = this.#sql_query(sql, []);
        const zveis = rows.then(res => {
            return res.map(r => {
                return Z.mk_zvei(r.zvei_id, r.description, r.test_day, r.test_time_start, r.test_time_end);
            });
        });
        return zveis;
    }

    /**
     * Returns the ZVEI for a given ZVEI ID or empty if no ZVEI for the ID exists.
     * @param {Z.ZVEIID} zvei_id 
     * @returns {Promise<Optional<Z.ZVEI>>}
     */
    async get_ZVEI(zvei_id) {
        const sql = `
        SELECT *
        FROM ZVEI
        WHERE zvei_id = ?
        `;

        let params = [zvei_id.id];
        let rows = await this.#sql_query(sql, params);
        if (rows.length != 1) {
            return Optional.empty();
        } else {
            const r = rows[0];
            const zvei = Z.mk_zvei(r.zvei_id, r.description, r.test_day, r.test_time_start, r.test_time_end);
            return Optional.of(zvei);
        }
    }


    /**
     * Get the ZVEI description.
     * @param {Z.ZVEIID} zvei_id ID of the ZVEI unit.
     * @returns {Promise<Optional<String>>} The ZVEI description (if the ZVEI exists)
     */
    async get_ZVEI_details(zvei_id) {

        let sql = `
        SELECT description
        FROM ZVEI
        WHERE zvei_id = ?
    `;
        let params = [zvei_id.id];
        let rows = await this.#sql_query(sql, params);
        if (rows.length != 1) {
            return Optional.empty();
        } else {
            const desc = rows[0].description;
            return Optional.of(desc);
        }
    }

    /**
     * 
     * @param {Z.ZVEI} zvei 
     * @returns {Promise<boolean>}
     */
    async add_ZVEI(zvei) {
        let sql = `
        INSERT INTO ZVEI(zvei_id, description, test_day, test_time_start, test_time_end)
        VALUES (?, ?, ?, ?, ?)
        `;
        let params = [zvei.id.id, zvei.description, zvei.test_day, zvei.test_time_start, zvei.test_time_end];
        return this.#sql_run(sql, params);
    }

    /**
     * Removes a given ZVEI and all alarms for the ZVEI from the database
     * @param {Z.ZVEI} zvei 
     * @returns {Promise<boolean>} Whether the deletion succeeded
     */
    async remove_ZVEI(zvei) {

        const params = [zvei.id.id];

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
                this.db.run(sql_delete_zvei, params,(error) => {
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

