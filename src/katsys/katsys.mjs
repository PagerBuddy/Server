import WebSocket from "ws";
import fs from 'fs';
import winston from 'winston';

import * as myhealth from '../health.mjs';
import Schleife from './schleife.mjs'
import { KatSysAlert } from "./alert.mjs";
import KatSysUpdate from "./update.mjs";

export {Schleife, KatSysAlert, KatSysUpdate}

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

import loggers from '../logging.mjs'

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


/**
 * @callback katsys_alert_callback
 * @param {Number} zvei The alert ZVEI.
 * @param {Number} timestamp The offset corrected timestamp for the alert.
 * @param {String} msg The additional alert text.
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
        /**@type {import('./update.mjs').katsys_update} */
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
            const alert = KatSysAlert.alert_from_json(katsys_update.data.textElements, ALERT_TIME_ZONE, KATSYS_DECODE_CHANNELS, log);
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
        const timestamp = schleife.alert_timestamp(alert_data.timestamp_ms, ALERT_TIME_ZONE)
        alert_callback(schleife.zvei, timestamp, alert_data.msg)
    });

    const health_data = {
        timestamp: alert_data.timestamp_ms,
        siteId: siteID
    };
    health.radio_activity(health_data);
}
