import WebSocket from "ws";
import fs from 'fs';
import winston from 'winston';

import * as myhealth from './health.mjs';

//Ref: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
const CODE_PAGERBUDDY_STOP = 4000;

const siteID = "KatSys";

/**@type {boolean} */
let ENABLED = false;

/** @type {string} */
let KATSYS_MASTER_TOKEN;
/** @type {string} */
let KATSYS_SUB_TOKEN;
/** @type {string} */
let KATSYS_CERTIFICATE;
/** @type {string} */
let ALERT_TIME_ZONE;
/** @type {Array<string>} */
let KATSYS_DECODE_CHANNELS = [];

/** @type {winston.Logger} */
let log;

/** @type {myhealth} */
let health;

/** @type {WebSocket} */
let socket;

import loggers from './logging.mjs'

/**
 * 
 * @param {{enabled: boolean, certificate_location: string, master_token: string, sub_token: string, decode_channels: string[]}} katsys_config 
 * @param {string} timezone 
 * @param {myhealth} health_ 
 */
export function init(katsys_config, timezone, health_) {
    log = loggers("KatSys");
    ENABLED = katsys_config.enabled;
    KATSYS_MASTER_TOKEN = katsys_config.master_token;
    KATSYS_SUB_TOKEN = katsys_config.sub_token;
    KATSYS_CERTIFICATE = katsys_config.certificate_location;
    KATSYS_DECODE_CHANNELS = katsys_config.decode_channels;
    ALERT_TIME_ZONE = timezone
    health = health_
}

//Exports only because of testing - bad practice?
export class Schleife {

    //lets make these private by default
    #group;
    zvei;
    #alert_time;

    /**
     * @param {string} schleife_desc The textual description of the Schleife
     */
    constructor(schleife_desc) {
        if (!schleife_desc) {
            throw new Error('No parameter provided')
        }
        if (schleife_desc.split(" ").length > 3) {
            throw new Error(`Too many parameters for Schleife provided: ${schleife_desc}`)
        }
        const [group, zvei, alert_time] = schleife_desc.split(" ");
        if (zvei.length < 4 || zvei.length > 5) {
            throw new Error(`Invalid ZVEI: ${zvei}`);
        }
        if (zvei.length == 4) {
            this.zvei = parseInt(`2${zvei}`);
        }
        else {
            this.zvei = parseInt(zvei);
        }

        if (alert_time.split(":").length != 2) {
            throw new Error(`Invalid alert time: ${alert_time}`);
        }
        this.#group = group.toString();
        this.#alert_time = alert_time;
    }

    /**
     * @param {string[]} channels_to_consider Array of 
     * @returns {boolean} true Iff the schleife should be notified/alerted
     */
    of_interest(channels_to_consider) {
        return channels_to_consider.includes(this.#group);
    }

    /**
     * @param {number} timestamp_ms 
     * @returns {number}
     */
    alert_timestamp(timestamp_ms) {
        //KatSys pings do not have a timestamp, we have to make one in KatSys time ourselfs

        let outTime = timestamp_ms;
        //We have to manually check if time is accurate, as it may be a changed alert with wrong time
        if (Date.now() - timestamp_ms > 1000 * 60) {
            //Timestamp is older than a minute, check if alternative timestamp fits

            let alt_timeseg = this.#alert_time.split(":"); //get HH and MM
            let alt_timestamp = parseInt(alt_timeseg[0]) * 60 + parseInt(alt_timeseg[1]); //Timestamp from delta in minutes
            const tzTime = new Date(new Date(Date.now()).toLocaleString("en-US", { timeZone: ALERT_TIME_ZONE })); //We assume KatSys is in alert time
            let ref_timestamp = tzTime.getHours() * 60 + tzTime.getMinutes(); //Timestamp now in Katsys time

            if (ref_timestamp - alt_timestamp < 2) {
                //Alternative timestamp is within two minutes of now time - use now time
                outTime = Date.now();
            }
        }
        return outTime;
    }
}

/**
 * @typedef {Object} katsys_update
 * @property {string} type 'data'
 * @property {string} statusCode 'alarm_data'
 * @property {string} statusClass 'success'
 * @property {katsys_data|undefined} data
 */
/**
 * @typedef {Object} katsys_data
 * @property {katsys_alert} textElements
 */
/**
 * @typedef {Object} katsys_alert
 * @property {string} alarmdatum '01.01.2022'
 * @property {string} alarmuhrzeit '10:10:10'
 * @property {string} einsatzort '91000 Wunschort - Wunschort'
 * @property {string} schlagwort '#R9012#KTP#KTP - Heimfahrt'
 * @property {string} schleifen_delta '123 25123 10:10\nRD_NN 5123 10:10'
 */

export class KatSysAlert {
    //location;
    //keyword;
    msg;
    timestamp_ms;
    schleifen_of_interest;

    /**@type {Schleife[]} */
    schleifen = []; //This is only exposed because of test - bad practise?

    /**
     * 
     * @param {string} alert_date 
     * @param {string} alert_time 
     * @param {string} location 
     * @param {string} keyword 
     * @param {string} schleifen_delta 
     */
    constructor(alert_date, alert_time, location, keyword, schleifen_delta) {
        //this.location = location;
        //this.keyword = keyword;

        this.msg = `<b>${keyword}</b>\n${location}`

        const raw_schleifen = schleifen_delta.split('\n');
        raw_schleifen.forEach((raw_schleife) => {
            try{
                const schleife = new Schleife(raw_schleife);
                this.schleifen.push(schleife);
            }catch(error){
                log.warn("Error generating alert list: " + error);
            }
        });
        
        const date_parts = alert_date.split(".")
        if (date_parts.length != 3) {
            log.warn(`Invalid date: ${alert_date}. Timestamp will probably be nonsensical.`);
        }
        const time_parts = alert_time.split(":")
        if (time_parts.length != 3) {
            log.warn(`Invalid time: ${alert_time}. Timestamp will probably be nonsensical.`);
        }
        const timestamp = new Date(
            parseInt(date_parts[2]),
            parseInt(date_parts[1]) - 1,
            parseInt(date_parts[0]),
            parseInt(time_parts[0]),
            parseInt(time_parts[1]),
            parseInt(time_parts[2])
        );

        const refTime = new Date(Date.now()); //Must use now to ensure correct DST
        const tzTime = new Date(refTime.toLocaleString("en-US", { timeZone: ALERT_TIME_ZONE })); //We assume KatSys is in alert time
        const tzOffset = Math.round((tzTime.getTime() - refTime.getTime()) / 1000 / 60) * 1000 * 60;

        this.timestamp_ms = timestamp.getTime() - tzOffset;

        this.schleifen_of_interest = this.schleifen.filter(s => {
            return s.of_interest(KATSYS_DECODE_CHANNELS);
        })
    }

    /**
    * @param {katsys_alert} textElements 
    * @returns {KatSysAlert}
    */
   static alert_from_json(textElements) {
       return new this(
           textElements.alarmdatum,
           textElements.alarmuhrzeit,
           textElements.einsatzort,
           textElements.schlagwort,
           textElements.schleifen_delta
       );
   }
}

class KatSysUpdate {
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


/**
 * @callback katsys_alert_callback
 * @param {Number} zvei The alert ZVEI.
 * @param {Number} timestamp The offset corrected timestamp for the alert.
 * @param {String} msg The additional alert text.
 * @returns {void}
 */

/**
 * Setup the websocket client for katsys, set listeners, and connect.
 * @param {katsys_alert_callback} alert_callback 
 * @returns {void}
 */
export function start(alert_callback) {
    if (!ENABLED) {
        return;
    }

    const katsysURL = "wss://connect.katsys.cloud:81";

    socket = new WebSocket(katsysURL, {
        ca: [fs.readFileSync(KATSYS_CERTIFICATE)],
        headers: {
            "master_token": KATSYS_MASTER_TOKEN,
            "sub_token": KATSYS_SUB_TOKEN
        }
    });

    socket.on("open", () => {
        log.debug('Connection to KatSys was established.');
        heartbeat();
    });
    socket.on("close", (/**@type {Number} */ code) => {
        switch (code) {
            case CODE_PAGERBUDDY_STOP:
                //Do nothing as the socket is shutting down purposefully
                break;
            default:
                log.debug('KatSys connection closed. Reopening...');
                setTimeout(() => { start(alert_callback) }, 1000 * 10); //Delay 10s before reconnection attempt
        }
    });
    socket.on("error", (/**@type {any} */ error) => {
        log.error("An error occured on KatSys socket: " + error.message);
    });
    socket.on("ping", () => {
        heartbeat();
    });
    socket.on("message", (/**@type {string} */ data) => {
        /**@type {katsys_update} */
        const jsonData = JSON.parse(data);

        let katsys_update;
        try {
            katsys_update = KatSysUpdate.update_from_json(jsonData);
        } catch (error) {
            log.error(`Could not parse KatSys msg: ${data} -- ${error}`);
            return
        }

        if (katsys_update.status_class == "success") {
            log.silly("Katsys status: " + jsonData.statusCode)
        } else {
            log.warn("KatSys status: " + jsonData.statusCode);
            return;
        }

        if (katsys_update.status_code == "alarm_data" && katsys_update.data) {
            const alert = KatSysAlert.alert_from_json(katsys_update.data.textElements);
            handle_alert(alert, alert_callback);
        }

    });

}

/**
 * Gracefully close socket.
 * @returns {void}
 */
export function close() {
    if (socket?.readyState > 0) {
        socket.close(CODE_PAGERBUDDY_STOP);
    }
}

/**
 * Report KatSys connection alive to health.
 * @returns {void}
 */
function heartbeat() {
    const health_data = {
        timestamp: Date.now(),
        siteId: siteID
    };
    health.report_health(health_data);
}

/**
 * Handle an incoming alert. Trigger callback for each viable alert in data (i.e. ZVEI and alert group fits, not older than two minutes).
 * @param {KatSysAlert} alert_data 
 * @param {katsys_alert_callback} alert_callback 
 * @returns {void}
 */
export function handle_alert(alert_data, alert_callback) {
    alert_data.schleifen_of_interest.forEach(schleife => {
        const timestamp = schleife.alert_timestamp(alert_data.timestamp_ms)
        alert_callback(schleife.zvei, timestamp, alert_data.msg)
    });

    const health_data = {
        timestamp: alert_data.timestamp_ms,
        siteId: siteID
    };
    health.radio_activity(health_data);
}
