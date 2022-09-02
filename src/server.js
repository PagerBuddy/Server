"use strict";

/**@module server */

import { hideBin } from 'yargs/helpers';

import * as logging from './logging.mjs';
import * as schedule from 'node-schedule';

import * as websocket from './websocket.mjs';
import * as  telegram_bot from './telegram/bot.mjs';
import * as database from './db.mjs'
import * as  health from './health.mjs';
import * as messaging from './messaging.mjs';
import * as katsys from './katsys/katsys.mjs';
import winston from 'winston';
import { Config } from './config.js';
import ZVEI from './model/zvei.mjs';

/**
 * Alarm queue callback
 * @callback alarm_queue_callback
 * @param {boolean} result
 */

/**
 * Alarm queue item
 * @typedef {Object} queue_item
 * @property {string} text
 * @property {number} zvei_id
 * @property {number} timestamp
 * @property {number} information_content
 * @property {alarm_queue_callback} result_callback
 */

/** @type {queue_item[]} */
const alarm_queue = [];

/** @type {boolean} */
let alarm_queue_active = false;

/** @type {winston.Logger} */
let logger;

let CONFIDENTIAL_MODE = false;

/** @type {database.database} */
let db;

/** @type {string} */
let alert_time_zone

/**
 * Queue an alarm to be sent as soon as possible. This avoids double alerts slipping through.
 * @param {Number} zvei_id - ZVEI ID of the group to be alarmed.
 * @param {Number} timestamp Point in Unix-time when alerm was detected by decoder.
 * @param {Number} information_content The information level of the alarm source. This is a INFORMATION_CONTENT integer for the alarm interface.
 * @param {String} text  Content of the alert message.
 * @return {Promise<boolean>} Awaitable that returns once the alarm has been handled. False if the alarm was supressed, true otherwise.
 */
export function queue_alarm(zvei_id, timestamp, information_content, text = '') {

  return new Promise((resolve) => {
    let alarm_item = {
      text: text,
      zvei_id: zvei_id,
      timestamp: timestamp,
      information_content: information_content,
      result_callback: resolve
    };
    alarm_queue.push(alarm_item);
    run_queue();
  });
}

/**
 * Start alarm queue execution if currently not running.
 */
async function run_queue() {

  if (!alarm_queue_active) {
    await step_alarms();
  }
}

/**
 * Execute alarm queue step if items are available.
 */
async function step_alarms() {


  if (alarm_queue.length < 1) {
    alarm_queue_active = false;
    return;
  }

  alarm_queue_active = true;
  let alarm_task = alarm_queue.shift();
  let alarm_result = false;
  if (alarm_task) {
    alarm_result = await alarm(alarm_task.zvei_id, alarm_task.timestamp, alarm_task.information_content, alarm_task.text);
    alarm_task.result_callback(alarm_result);
  }

  if (alarm_queue.length > 0) {
    await step_alarms();
  } else {
    alarm_queue_active = false;
  }
}

/**
 * Activates alarm for a given group.
 * For example: zvei_id = 25978 -> Schnelleinsatzgruppe Transport ER Stadt 1 (SEG Tr ER 1)
 *
 * @param {Number} zvei_id ZVEI ID of the group to be alarmed.
 * @param {Number} timestamp Point in Unix-time when alerm was detected by decoder.
 * @param {Number} information_content The information level of the alarm source. This is a INFORMATION_CONTENT integer for the alarm interface.
 * @param {String} text Content of the alert message.
 * @param {Boolean} is_manual  If the alert was triggered manually (typically for testing).
 * @return {Promise<Boolean>} If the alert was sent or supressed. 
 */
async function alarm(zvei_id, timestamp, information_content, text = '', is_manual = false) {

  const zvei_ = await db.get_ZVEI(zvei_id);

  let zvei;
  try{
    zvei = zvei_.orElseGet(() => new ZVEI(zvei_id));
  }catch(error){
    logger.error(error);
    logger.error("Error parsing alert id. This is fatal - alert will not be handled.");
    return false;
  }
  


  if (timestamp + 1000 * 60 * 2 < Date.now()) { //The alert is older than two minutes and therefore obsolete
    logger.info("An obsolete alert (older than two minutes) was received and ignored.");
    return false;
  }

  let is_information_update = false;
  if (await db.is_repeat_alarm(zvei)) {
    if (await db.is_alarm_information_update(zvei, information_content)) {
      is_information_update = true; //If more information is available alert Telegram groups but do not send FCM
      logger.debug("Repeat alarm with information update.");
    } else {
      logger.debug("Repeat alarm suppressed.");
      return false;
    }
  }

  //As we have a real alert - log it
  await db.add_alarm_history(zvei, timestamp, information_content);

  // 1. Get chat IDs of the given group
  let chat_ids = await db.get_chat_ids_from_zvei(zvei);

  //Add chat_ids of special groups subscribed to all alerts
  const SYSTEM__ALL_ALERTS = (await db.get_ZVEI(10)).get(); //10 is special ID for all alerts
  let extra_ids = await db.get_chat_ids_from_zvei(SYSTEM__ALL_ALERTS); 
  chat_ids.push(...extra_ids);

  // 2. Send message in that chat + create response overview
  if (CONFIDENTIAL_MODE) {
    text = "Alert anonymised";
    zvei.id = 10000;
  }

  let promises = [];
  for (let index in chat_ids) {
    if (chat_ids[index] != null && chat_ids[index] != 0) {
      promises.push(telegram_bot.send_alert(chat_ids[index], zvei, timestamp, alert_time_zone, is_manual, text));
    }
  }

  let tokenArray = await db.get_device_ids_from_zvei(zvei);
  if (!is_information_update && !is_manual) { //Only send app alerts for unique alerts
    promises.push(messaging.sendAlert(tokenArray, timestamp, alert_time_zone, zvei));
  }

  // 4. Feedback on log
  logger.debug(`Alarm sent out for ZVEI ID ${zvei_id}`);

  //Wait for everything to complete
  await Promise.allSettled(promises);
  return true

}

/**
 * To reduce execution time on alert user group status is not checked ad-hoc. Instead a periodic task is run to elimate invalid users regularly.
 * This sets up the "cleaner" process.
 * @param {String} timezone Timezone to use to determine periodic execution time.
 * @param {Number} hour At which hour of the day the cleanup process should be run (every day).
 */
function setup_cleaner(timezone, hour = 0) {


  //run cleanup at midnight every day in alert timezone
  const rule = new schedule.RecurrenceRule();
  rule.hour = hour;
  rule.minute = 0;
  rule.tz = timezone;

  schedule.scheduleJob(rule, async function () {
    //Remove all invalid memberships from DB
    telegram_bot.remove_invalid_user_subscriptions();

    //Check and remove all invalid FCM device IDs
    const check_list = await db.get_check_users_list();
    await messaging.heartbeatProbe(check_list);

  });
}

/**
 * Callback to queue an alert received internally through KatSys.
 * @param {Number} zvei The alert ZVEI.
 * @param {Number} timestamp The offset corrected timestamp for the alert.
 * @param {String} msg The additional alert text.
 */
function queue_katsys(zvei, timestamp, msg) {
  logger.debug(`Received internal alert ${zvei} from KatSys`);
  queue_alarm(zvei, timestamp, 2, msg);
}

/**
 * Startup server with all connected stuff...
 */
export async function start() {

  //command line options
  const cli_options = hideBin(process.argv);

  const config = new Config(cli_options);

  logging.set_logging_level(config.settings.log_level);
  logger = logging.default("Server");

  alert_time_zone = config.alert_time_zone

  db = await database.create_database(alert_time_zone, config.timeouts.history, config.files.database_location);

  messaging.init(db, alert_time_zone, config.messaging);

  health.init(config.timeouts, alert_time_zone);
  health.start_health_monitoring();

  telegram_bot.init(db, config.telegram, alert_time_zone, health, messaging); 
  telegram_bot.start_bot();

  websocket.init(config.websocket, health);
  katsys.init(config.katsys, alert_time_zone, health)

  logging.connect_telegram_transport(db.get_chat_ids_from_zvei.bind(db), telegram_bot.queue_message);

  await websocket.start_listening(queue_alarm);
  katsys.start(queue_katsys);

  setup_cleaner(alert_time_zone);

  logger.info("Server started.");
}

/**
 * Cleanly end the server.
 */
export async function stop() {

  logger.warn("Stopping server...");

  //Graceful shutdown of cleaning job
  schedule.gracefulShutdown();

  katsys.close();
  websocket.stop_listening();
  health.stop_health_monitoring();
  await telegram_bot.stop_bot();
  db.close();
}
