import sqlite3 from 'sqlite3';
import logger from './logging.mjs'
import { existsSync } from 'fs'
import * as Z from './model/zvei.mjs'

class database {
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
 * Executes an SQL query with the given parameters.
 * @param {string} sql SQL query to be executed.
 * @param {Array<string|number>} params list of parameters.
 * @returns {Promise<Array<Object.<String,String|number>>>} result rows.
*/
    sql_query(sql, params) {

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
     * Returns all ZVEI units
     * @returns {Promise<Z.ZVEI[]>}
     */
    get_ZVEIs() {
        let sql = `
        SELECT *
        FROM ZVEI
        `;

        const rows = this.sql_query(sql, []);
        const zveis = rows.then(res => {
            return res.map(r => {
                return Z.mk_zvei(r.zvei_id, r.description, r.test_day, r.test_time_start, r.test_time_end);
            })
        });

        return zveis;
    }


    /**
     * Get the ZVEI description.
     * @param {Z.ZVEIID} zvei_id ID of the ZVEI unit.
     * @returns {Promise<string>} The ZVEI description or "".
     */
    async get_zvei_details(zvei_id) {

        let sql = `
        SELECT description
        FROM ZVEI
        WHERE zvei_id = ?
    `;
        let params = [zvei_id.id];
        let rows = await this.sql_query(sql, params);
        if (rows.length != 1) {
            return "";
        } else {
            const desc = rows[0].description;
            return desc;
        }
    }
}

/**
 * 
 * @param {string} timezone 
 * @param {number} history_timeout 
 * @param {string} db_path 
 * @returns {Promise<database>} 
 */
export default async function create_database(timezone, history_timeout, db_path) {
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

