"use strict";

import { google } from 'googleapis';
import * as  https from 'https';
import loggers from './logging.mjs'
import winston from 'winston';
import * as mydata from './data.js';
import ZVEI from './model/zvei.mjs'

/**@type {boolean} */
let ENABLED = false;

/**@type {mydata} */
let db;

/**@type {winston.Logger} */
let log;

/**@type {Object.<string,string>} */
let FCM_CREDENTIALS;

/** @type {string} */
let ALERT_TIME_ZONE = "";

/**
 * 
 * @param {*} database 
 * @param {string} timezone 
 * @param {{enabled: boolean, fcm_credentials: Object.<string, string>}} config 
 */
export function init(database, timezone, config) {
  log = loggers("Messaging");
  ENABLED = config.enabled;
  db = database;
  ALERT_TIME_ZONE = timezone;
  FCM_CREDENTIALS = config.fcm_credentials;
}

/**
 * Send an FCM/APNS package containing the alert to the list of devices.
 * @param {Array<{token: string, chat_id: string, user_id: number}>} token_chat_array: The FCM tokens (and the causing chatIDs) to send the package to.
 * @param {number} alert_timestamp: The timestamp (in system time zone) when the alert was received.
 * @param {string} alert_time_zone The alert ID. Use this to obtain an alert description from DB.
 * @param {ZVEI} zvei The ZVEI that is to be alerted
 * @returns {Promise<boolean>} True if all alerts were sent successfully, false otherwise.
 */
export async function sendAlert(token_chat_array, alert_timestamp, alert_time_zone, zvei) {
  if (!ENABLED) {
    return false;
  }


  const date = new Date();
  const offset = date.getTimezoneOffset(); //TZ offset to UTC in min

  let messages = [];
  /**@type {number[]} */
  let user_ids = [];
  for (let item in token_chat_array) {
    messages.push(
      getFCMJSON(token_chat_array[item].token,
        parseInt(token_chat_array[item].chat_id),
        zvei.id, zvei.description,
        zvei.is_test_time(alert_timestamp, alert_time_zone),
        alert_timestamp + offset,
        false)
    );
    user_ids.push(token_chat_array[item].user_id);
  }

  return await sendFcmMessages(messages, user_ids);
}

/**
  * Construct and send an FCM test message to supplied token.
  * @param {string} token: FCM device token.
  * @param {number} chat_id: ID that requested alert.
  * @param {number} user_id: User that requested alert.
  * @returns {Promise<boolean>} True if message was sent successfully.
  */
export async function sendTest(token, chat_id, user_id) {
  if (!ENABLED) {
    return false;
  }

  const date = new Date();
  const alert_timestamp = Date.now() + date.getTimezoneOffset();

  let alert_zvei_id = 99999;
  let alert_zvei_description = "PagerBuddy alert test.";

  let messages = [];
  let user_ids = [];
  messages.push(getFCMJSON(token, chat_id, alert_zvei_id, alert_zvei_description, false, alert_timestamp, true));
  user_ids.push(user_id);
  return await sendFcmMessages(messages, user_ids);
}

/**
 * Send a list of FCM JSON messages to the FCM server.
 * @param {string[]} fcmMessage The list of well-formatted JSON payloads.
 * @param {number[]} user_ids List of user ids linked to the FCM messages.
 * @returns {Promise<boolean>} True if all messages were sent successfully, false otherwise.
 */

async function sendFcmMessages(fcmMessage, user_ids) {

  const accessToken = await getAccessToken();

  const key = FCM_CREDENTIALS;

  const options = {
    hostname: 'fcm.googleapis.com',
    path: '/v1/projects/' + key.project_id + '/messages:send',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  };

  let promises = [];
  for (var msg in fcmMessage) {
    let promise_res = new Promise((resolve, reject) => {
      const request = https.request(options, function (resp) {
        resp.setEncoding('utf8');
        resp.on('data', function (data) {
          let jsonResponse;
          try {
            jsonResponse = JSON.parse(data);
          } catch (error) {
            log.error("Error sending FCM message. Response too large to parse: " + data);
            reject(data);
            return;
          }
          if (jsonResponse.error != null) {
            if (jsonResponse.error.code == 404 && jsonResponse.error.status == "NOT_FOUND") {
              //Device ID does not exist (any more) - delete it.
              var user_id = user_ids[msg];
              log.debug("FCM responded entity not found. Removing user.");
              db.remove_user(user_id);
            } else {
              log.error("Error sending FCM message: " + data);
            }
            reject(jsonResponse.error);
          } else {
            log.silly('Message sent to Firebase for delivery, response:');
            log.silly(data);
            resolve(data);
          }

        });
      });

      request.on('error', function (err) {
        log.warn('Unable to send message to Firebase');
        log.warn(err);
        reject(err);
      });

      request.write(fcmMessage[msg]);
      request.end();
    });

    promises.push(promise_res);
  }

  const values = await Promise.allSettled(promises);
  for (let element in values) {
    if (values[element].status == "rejected") {
      return false;
    }
  }
  return true;
}

/**
 * Get a short-lived access token from FCM server.
 * @returns {Promise<string|null|undefined|Error>} A promise that will resolve an access token on success.
 */
function getAccessToken() {

  return new Promise(function (resolve, reject) {
    const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
    const SCOPES = [MESSAGING_SCOPE];

    const key = FCM_CREDENTIALS;
    const jwtClient = new google.auth.JWT(
      key.client_email,
      "",
      key.private_key,
      SCOPES,
      ""
    );
    jwtClient.authorize(function (err, tokens) {
      if (err) {
        reject(err);
        return;
      }
      resolve(tokens?.access_token);
    });
  });
}
/**
 * Constructs the FCM message to be sent.
 * @param {string} device_token The FCM token to send to.
 * @param {number} chat_id The linked chat ID causing the FCM alert.
 * @param {number} zvei_id The ZVEI (typically 5 digits) of the alerted unit.
 * @param {string} zvei_description A text description of the unit
 * @param {boolean} is_test_time Whether the test time filter is active.
 * @param {number} alert_timestamp The UNIX-timestamp of the alert.
 * @param {boolean} manual_test If this alert was requested by the user.
 * @returns {string} A ready to send JSON payload.
 */
function getFCMJSON(device_token, chat_id, zvei_id, zvei_description, is_test_time, alert_timestamp, manual_test) {

  const fcm_ttl = 15 * 60; //Remove alert after 15min, if not delivered

  //FCM only knows strings!
  let fcm = {
    message: {
      token: device_token,
      data: {
        zvei: zvei_id.toString(),
        zvei_description: zvei_description,
        is_test_alert: is_test_time.toString(),
        alert_timestamp: alert_timestamp.toString(),
        chat_id: chat_id.toString(),
        is_manual_test_alert: manual_test.toString()
      },
      android: {
        priority: "high",
        ttl: fcm_ttl.toString() + "s"
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-expiration": (Math.round(alert_timestamp / 1000) + fcm_ttl).toString()
        },
        payload: {
          aps: {}
        }
      }
    }
  }

  const timestamp_obj = new Date(alert_timestamp);
  const timestamp_string = timestamp_obj.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: ALERT_TIME_ZONE });

  const msg_body = zvei_description;

  if (is_test_time) {
    let aps = {
      alert: {
        "title-loc-key": "TEST_ALERT_TITLE",
        "loc-key": "TEST_ALERT_MESSAGE",
        "loc-args": [msg_body, timestamp_string]
      },
      sound: {
        critical: 1,
        name: "pagerbuddy_sound_long.wav",
        volume: 0.5
      },
      "interruption-level": "critical"
    }
    fcm.message.apns.payload.aps = aps;
  } else {
    let aps = {
      alert: {
        "title-loc-key": "ALERT_TITLE",
        "loc-key": "ALERT_MESSAGE",
        "loc-args": [msg_body, timestamp_string]
      },
      sound: {
        critical: 1,
        name: "pagerbuddy_sound_long.wav",
        volume: 1.0
      },
      "interruption-level": "critical"
    }
    fcm.message.apns.payload.aps = aps;
  }

  const json = JSON.stringify(fcm);
  return json;

}

/**
 * Sends a non-user-facing notification to the specified tokens to check if the tokens are (still) valid. Possibly necessary cleanup is handled in the send function.
 * @param {{user_id: number, token: string}[]} check_list List of users to check.
 */
export async function heartbeatProbe(check_list) {

  /**@type {string[]} */
  let message_list = [];
  /**@type {number[]} */
  let user_list = [];

  check_list.forEach(item => {
    const fcm = {
      message: {
        token: item.token,
        apns: {
          headers: {
            "apns-priority": "5"
          }
        }
      }
    }
    const json = JSON.stringify(fcm);

    message_list.push(json);
    user_list.push(item.user_id);

  });

  await sendFcmMessages(message_list, user_list);
}
