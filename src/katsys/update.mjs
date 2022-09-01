/**
 * @typedef {Object} katsys_update
 * @property {string} type 'data'
 * @property {string} statusCode 'alarm_data'
 * @property {string} statusClass 'success'
 * @property {katsys_data|undefined} data
 */


/**
 * @typedef {Object} katsys_data
 * @ts-ignore
 * @property {katsys_alert} textElements
 */

/**
 * @callback katsys_alert_callback
 * @param {Number} zvei The alert ZVEI.
 * @param {Number} timestamp The offset corrected timestamp for the alert.
 * @param {String} msg The additional alert text.
 * @returns {void}
 */

 export default class KatSysUpdate {
    /**
     * 
     * @param {string} type 'data'
     * @param {string} status_code 'alarm_data'
     * @param {string} status_class 'success'
     * @param {katsys_data|undefined} katsys_data
     */
    constructor(type, status_code, status_class, katsys_data = undefined) {
        this.type = type;
        this.status_code = status_code;
        this.status_class = status_class;
        this.data = katsys_data;
    }

    /**
     * @param {katsys_update} json 
     * @returns {KatSysUpdate}
     */
    static update_from_json(json) {
        return new this(json.type, json.statusCode, json.statusClass, json.data);
    }
}


