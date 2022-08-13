"use strict";
import { resolve as dns_resolve } from 'dns'
import winston from 'winston';

/** @type {number} */
let INTERNET_TIMEOUT;
/** @type {number} */
let HEALTH_TIMEOUT;
/** @type {number} */
let RADIO_TIMEOUT;
/** @type {string} */
let ALERT_TIME_ZONE;

/** @type {NodeJS.Timer} */
let health_checker;

import loggers from './logging.mjs'
/** @type {winston.Logger} */
let log;

/**
 * 
 * @param {{health: number, radio_activity: number, internet: number}} timeout_config 
 * @param {string} timezone 
 */
export function init(timeout_config, timezone) {
    log = loggers("Health");
    INTERNET_TIMEOUT = timeout_config.internet;
    HEALTH_TIMEOUT = timeout_config.health;
    RADIO_TIMEOUT = timeout_config.radio_activity;
    ALERT_TIME_ZONE = timezone;
}

/**
 * An alert interfaces health state.
 * @typedef {Object} health_state
 * @property {number} time
 * @property {boolean} time_ok
 * @property {number} radio_time
 * @property {boolean} radio_ok
 * @property {number} time_offset
 * @property {boolean} time_offset_ok
 */

/**@type {Object.<string, health_state>} */
var device_health = {}; //This is filled with interface devices as they connect

var internet = {
    time: 0,
    time_ok: false
};

let sent_health_time = 0;

let telegram = {
    offline_time: Number.MAX_SAFE_INTEGER,
    reported_online: true
}

/**
 * Report health status from telegram bot. This is used for 50x errors.
 * @param {boolean} is_ok 
 */
export function telegram_status(is_ok = true) {
    if (is_ok && !telegram.reported_online) {
        log.info("Telegram server is online again.");
        telegram.offline_time = Number.MAX_SAFE_INTEGER;
        telegram.reported_online = true;
    } else if (!is_ok) {
        if (telegram.offline_time == Number.MAX_SAFE_INTEGER) {
            telegram.offline_time = Date.now();
        }
        if (telegram.offline_time + HEALTH_TIMEOUT < Date.now() && telegram.reported_online) {
            log.warn(`Telegram has been offline for more than ${HEALTH_TIMEOUT / 1000}s.`);
            telegram.reported_online = false;
        }

    }
}
/**
 * Lookup a siteID in the known list and retrieve a time offset to be applied to the timestamp.
 * @param {string} site_id The string descriptor of the known interface.
 * @returns {number} A integer representing the interface time offset in comparison to the server in ms. 0 if interface unknown.
 */

export function get_time_offset(site_id) {

    for (let siteID in device_health) {
        if (site_id == siteID) {
            let site = device_health[siteID];
            return site.time_offset;
        }
    }
    return 0;
}

/**
 * A health update was received from the device handle it here.
 * @param {{siteId: string, timestamp: number}} health_update The update package.
 */
export function report_health(health_update) {

    
    const time = health_update.timestamp;

    let success = false;
    for (let siteID in device_health) {
        if (health_update.siteId == siteID) {
            let site = device_health[siteID];
            site.time = time - site.time_offset;

            if (Math.abs(site.time - Date.now()) > 1000 * 60) {
                if (site.time_offset_ok) {
                    site.time_offset_ok = false;
                    let serverTime = new Date(Date.now());
                    let siteTime = new Date(site.time);

                    log.warn(`The health timestamp from interface ${siteID} has a significant offset.`
                        + `This is either due to a very slow connection or an incorrect system clock.\n`
                        + `Server time: ${serverTime.toLocaleString("de-DE")}\nInterface time: ${siteTime.toLocaleString("de-DE")}`);
                }
            } else if (!site.time_offset_ok) {
                site.time_offset_ok = true;
                log.info(`Timestamp for interface ${siteID} is ok again.`);
            }

            success = true;
            break;
        }
    }

    if (!success) {
        //Calculate time offset
        let timezone = Math.round((time - Date.now()) / (1000 * 60 * 60)); //Find closest hour

        let newDevice = {
            time: time + timezone * 60 * 60 * 1000,
            time_ok: true,
            radio_time: time + timezone * 60 * 60 * 1000,
            radio_ok: true,
            time_offset: timezone * 60 * 60 * 1000,
            time_offset_ok: true
        };

        device_health[health_update.siteId] = newDevice;

        log.info(`New interface connected. Site ${health_update.siteId} (Relative TZ ${timezone}).`);
    }
}

/**
 * An alert was received from a device. This is used to set the radio activity timestamp.
 * @param {{siteId: string, timestamp: number}} alert_update The update package received.
 */
export function radio_activity(alert_update) {

    for (let siteID in device_health) {
        let site = device_health[siteID];
        if (alert_update.siteId == siteID) {
            site.radio_time = alert_update.timestamp - site.time_offset;
            break;
        }
    }

}

function check_health() {
    /**
     * Perform a health check and send alert infos if something is worng.
     */


    dns_resolve('www.google.com', function (err) {
        if (!err) {
            internet.time = Date.now();
        }
    });
    let time_difference = Date.now() - internet.time
    if (internet.time_ok && time_difference > INTERNET_TIMEOUT) {
        log.warn(`Connection to WWW lost.`);
        internet.time_ok = false;
    }
    else if (!internet.time_ok && time_difference <= INTERNET_TIMEOUT) {
        log.warn(`Connection to WWW restored.`);
        internet.time_ok = true;
    }

    //- Connection to Telegram
    //- Status of alert providers
    //- Size of DB
    //- Possibly check of backlog queue (large queue is good index for undetected problems)

    var date = Date.now();
    for (let deviceID in device_health) {
        let device = device_health[deviceID];
        let time_difference = date - device.time;
        if (device.time_ok && time_difference > HEALTH_TIMEOUT) {
            let time_obj = new Date(device.time);
            let msg = `No health update received from ${deviceID} since ${time_obj.toLocaleString("de-DE", { timeZone: ALERT_TIME_ZONE })}.`;
            device.time_ok = false;
            log.warn(msg);
        } else if (!device.time_ok && time_difference < HEALTH_TIMEOUT) {
            let msg = `Health update received for ${deviceID}. Everything is ok again.`;
            device.time_ok = true;
            log.info(msg);
        }

        let radio_difference = date - device.radio_time;
        if (device.radio_ok && radio_difference > RADIO_TIMEOUT) {
            let time_obj = new Date(device.time);
            let msg = `No radio activity for device ${deviceID} since ${time_obj.toLocaleString("de-DE", { timeZone: ALERT_TIME_ZONE })}.`;
            device.radio_ok = false;
            log.warn(msg);
        } else if (!device.radio_ok && radio_difference < RADIO_TIMEOUT) {
            let msg = `Radio activity detected for device ${deviceID}. Everything is ok again.`;
            device.radio_ok = true;
            log.info(msg);
        }

    }

    let dateObj = new Date(date);
    if (date > (sent_health_time + 1000 * 60 * 60 * 24) && dateObj.getDay() == 2 && dateObj.getHours() == 20) {
        log.info(get_health_report());
        sent_health_time = date;
    }
}

    /**
     * Log a health report containing current status overview.
     * @returns {string} Formatted Health report for Telegram HTML.
     */
export function get_health_report() {


    let msg = `Interface Health report:\n`;

    for (let deviceID in device_health) {
        let device = device_health[deviceID];
        msg += "------------------------\n";
        msg += `<b>${deviceID}</b>\n`;
        msg += `Health report: <b>${device.time_ok ? "OK" : "TOO OLD"}</b>\n`;
        let health_time = new Date(device.time);
        let time_string = device.time == 0 ? "NEVER" : health_time.toLocaleString("de-DE", { timeZone: ALERT_TIME_ZONE });
        msg += `Time: ${time_string}\n`;
        msg += `Radio activity: <b>${device.radio_ok ? "YES" : "NO"}</b>\n`;
        let radio_time = new Date(device.radio_time);
        let radio_string = device.radio_time == 0 ? "NEVER" : radio_time.toLocaleString("de-DE", { timeZone: ALERT_TIME_ZONE });
        msg += `Last Radio: ${radio_string}\n`;
    }

    return msg;
}


export function start_health_monitoring() {
    /**
     * Start checking the system health regularly every 10s.
     */
    health_checker = setInterval(check_health, 10000);
}

export function stop_health_monitoring() {
    /**
     * Stop the periodic health check timer.
     */
    clearInterval(health_checker);
}