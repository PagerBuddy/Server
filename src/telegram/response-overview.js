/**@module telegram/response-overview */

import * as schedule from "node-schedule"
import winston from "winston";
import loggers from '../logging.mjs'

import * as bot from './bot.mjs'
import TelegramBot from 'node-telegram-bot-api';

/** @type {String} */
let TIMEZONE;
/** @type {boolean} */
let ENABLED;
/** @type {boolean} */
let ENABLED_FOR_ALL_CHATS;
/** @type {boolean} */
let ENABLED_DURING_TEST_ALARM;
/** @type {number[]} */
let CHAT_IDS = [];

/** @type {number} */
let COOLDOWN_MS;
/** @type {number} */
let REACT_TIMEOUT_MS;

/** @type {boolean} */
let PIN_MESSAGES;

/** @type {typeof bot.queue_message} */
let send_callback;
/** @type {typeof bot.queue_edit} */
let edit_callback;
/** @type {typeof bot.pin_message} */
let pin_callback;
/** @type {typeof bot.unpin_message} */
let unpin_callback;

/** @type {winston.Logger} */
let log;

/**
 * @typedef {Object} response_overview_config
 * @property {boolean} enabled
 * @property {boolean} enabled_all_chats
 * @property {boolean} enabled_during_test_alarm
 * @property {number[]} chat_ids
 * @property {number} cooldown_time
 * @property {number} react_timeout
 * @property {boolean} pin_messages
 */

/**
 * 
 * @param {response_overview_config} config 
 * @param {String} timezone 
 * @param {typeof bot.queue_edit} edit_callback_ 
 * @param {typeof bot.queue_message} send_callback_ 
 * @param {typeof bot.pin_message} pin_callback_ 
 * @param {typeof bot.unpin_message} unpin_callback_ 
 */
export function init(config, timezone, edit_callback_, send_callback_, pin_callback_, unpin_callback_) {
    log = loggers("ResponseOverview");
    TIMEZONE = timezone;
    ENABLED = config.enabled;
    ENABLED_FOR_ALL_CHATS = config.enabled_all_chats;
    ENABLED_DURING_TEST_ALARM = config.enabled_during_test_alarm;
    CHAT_IDS = config.chat_ids;
    COOLDOWN_MS = config.cooldown_time;
    REACT_TIMEOUT_MS = config.react_timeout;
    PIN_MESSAGES = config.pin_messages;

    send_callback = send_callback_;
    edit_callback = edit_callback_;
    pin_callback = pin_callback_;
    unpin_callback = unpin_callback_;
}

/**
 * @typedef {Object} ro_responses
 * @property {number} user_id
 * @property {string} time_string
 * @property {string} name
 * @property {boolean} accept
 * @property {boolean} backfill
 */


/**
 * @typedef {Object} ro_response_chat
 * @property {number} chat_id
 * @property {number} timestamp
 * @property {string} last_message
 * @property {number} last_message_id
 * @property {ro_responses[]} responses
 * @property {number} last_react
 * @property {schedule.Job|null} job
 * @property {((value: boolean | PromiseLike<boolean>) => void)[]} hanging_job_callbacks
 * 
 */

/**@type {Object.<number, ro_response_chat>} */
const responses = {};

//Unhandled rejection Error: ETELEGRAM: 400 Bad Request: message to unpin not found

/**
 * Creates the actual response message for a given chat by putting together the individual responses.
 * @param {number} chat_id ID of the chat.
 * @returns {string}
 */
function get_response_message(chat_id) {

    let accepts = 0;
    let rejects = 0;
    let backfills = 0;
    let time_string_alarm = (new Date(responses[chat_id].timestamp)).toLocaleString("de-DE", { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
    let responses_chat = responses[chat_id].responses;
    let accept_string = "";

    responses_chat.sort((a, b) => {
        return parseInt(a.time_string.replace(":", "")) - parseInt(b.time_string.replace(":", ""));
    });

    for (var i in responses_chat) {
        if (responses_chat[i].accept == true && responses_chat[i].backfill == false) {
            accept_string += responses_chat[i].name + ` [ETA: ${responses_chat[i].time_string}]` + "\n";
            accepts += 1;
        }
    }

    for (var i in responses_chat) {
        if (responses_chat[i].accept == true && responses_chat[i].backfill == true) {
            accept_string += responses_chat[i].name + ` [Nachrücken]` + "\n";
            backfills += 1;
        }
    }

    let reject_string = "";
    for (var i in responses_chat) {
        if (responses_chat[i].accept == false) {
            reject_string += responses_chat[i].name + "\n";
            rejects += 1;
        }
    }
    let message = `<b>Rückmeldungen zu Alarm um ${time_string_alarm}</b> (beta)\n\n<b>Zusagen (${accepts} + ${backfills}):</b>\n` + accept_string + `\n<b>Absagen (${rejects}):</b>\n` + reject_string;
    return message;
}

/**
 * Extract a user data set from an inline response.
 * @param {TelegramBot.CallbackQuery} callbackQuery: Callback query item used for processing.
 * @param {boolean} accept: Indicates whether a user pressed on one of the accept buttons or on the reject button.
 * @returns {ro_responses} User data struct.
 */
function get_response_user_data(callbackQuery, accept) {


    let estimated_time = 0
    if (accept == true) {
        let matches = callbackQuery.data?.match(/(?<=#)([0-9]{1,2})/);
        if(matches){
            estimated_time = parseInt(matches[1]);
        }
    }
    let user_id = callbackQuery.from.id;
    let name = "";
    if (callbackQuery.from.last_name) {
        name = callbackQuery.from.last_name + ", ";
    }
    name += callbackQuery.from.first_name;

    let eta = null;
    let time_string = "";
    let backfill = false; //"Nachrücken"
    if (accept == true) {
        if (estimated_time > 20) {
            eta = new Date(Date.now() + 20 * 60 * 1000);
            time_string = ">" + eta.toLocaleString("de-DE", { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
            backfill = true;
        }
        else {
            eta = new Date(Date.now() + estimated_time * 60 * 1000);
            time_string = eta.toLocaleString("de-DE", { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
        }
    }

    let r = {
        'user_id': user_id,
        'name': name,
        'accept': accept,
        'backfill': backfill,
        'time_string': time_string
    }

    return r;
}


/**
 * Send a message update.
 * @param {number} chat_id: Telegram chat id.
 * @param {string} message: Edited message to send.
 * @param {any} message_opts: The telegram struct for the message markup.
 * @returns {Promise<boolean>} True if sent update sucessfully. False if error occurred or content did not change.
 */
async function send_message_update(chat_id, message, message_opts) {


    if (responses[chat_id].last_message == message) {
        //Only update unique messages
        return false;
    }
    responses[chat_id].last_react = Date.now();
    responses[chat_id].last_message = message
    let res = await edit_callback(message, message_opts);
    return res.success;
}


/**
 * Trigger a message update if we have sufficient wiat time. Otherwise schedule a job for later.
 * @param {number} chat_id: Telegram chat id.
 * @param {string} message: Edited message to send.
 * @param {TelegramBot.SendMessageOptions} message_opts: The telegram struct for the message markup.
 * @return {Promise<boolean>} True once the update has been sent successfully. False on error.
 */
async function schedule_message_update(chat_id, message, message_opts) {


    const flood_delay = responses[chat_id].last_react + REACT_TIMEOUT_MS - Date.now();

    if (flood_delay > 0) {
        const job_time = new Date(Date.now() + flood_delay)
        return await new Promise((resolve) => {
            const job = schedule.scheduleJob(job_time, async function () {
                const res = await send_message_update(chat_id, message, message_opts);
                resolve(res);
            });
            job.addListener("canceled", function () {
                responses[chat_id].hanging_job_callbacks.push(resolve);
            });
            responses[chat_id].job = job;
        });
    } else {
        return await send_message_update(chat_id, message, message_opts);
    }
}

/**
 * This function is called when a user clicks on a button of the reponse overview message.
 * @param {TelegramBot.CallbackQuery} callbackQuery: Callback query item used for processing.
 * @param {boolean} accept: Indicates whether a user pressed on one of the accept buttons or on the reject button.
 * @return {Promise<boolean>} True if response was successfully handled. False otehrwise.
 */
export async function respond(callbackQuery, accept) {


    let chat_id = callbackQuery.message?.chat.id;
    if(!chat_id){
        return false;
    }

    let user_data = get_response_user_data(callbackQuery, accept);

    let responses_chat = responses[chat_id]?.responses;
    if (responses_chat) {
        //Cancel refresh job, if exists.
        responses[chat_id].job?.cancel();

        let user_found = false;
        for (var j in responses_chat) {
            if (responses_chat[j].user_id == user_data.user_id) {
                //Update response
                user_found = true;
                responses_chat[j] = user_data;
                break;
            }
        }

        if (!user_found) {
            //User has not responded yet, create a new entry
            responses_chat.push(user_data);
        }

        const message = get_response_message(chat_id);

        const opts = {
            reply_markup: callbackQuery.message?.reply_markup,
            parse_mode: /**@type {TelegramBot.ParseMode} */ ('HTML'),
            message_id: callbackQuery.message?.message_id,
            chat_id: chat_id
        };

        const res = await schedule_message_update(chat_id, message, opts);
        //Resolve hanging callbacks for canceled jobs
        responses[chat_id].hanging_job_callbacks.forEach(callback => {
            callback(res);
        });
        responses[chat_id].hanging_job_callbacks = [];
        return res;
    }
    return false;
}

/**
 * Create a response overview to allow users to respond to an alert. Overview is sent to specified chat id.
 * @param {number} chat_id Telegram chat id to send message to.
 * @param {boolean} is_test Wether this is a test alert ("Probealarm");
 * @returns {Promise<bot.bot_response>} Response of message send.
 */
export async function create_response_overview(chat_id, is_test) {

    let empty_response = {success: false, resend: false, msg_id: 0};

    if (!ENABLED) {
        log.silly(`Response overview deactivated.`);
        return empty_response;
    }
    if (!(ENABLED_FOR_ALL_CHATS || CHAT_IDS.includes(chat_id))) {
        log.silly(`Chat ${chat_id} not registered for response overview.`);
        return empty_response;
    }
    if (is_test && !ENABLED_DURING_TEST_ALARM) {
        log.silly("Not creating response overview for test alarm.");
        return empty_response;
    }


    let current_time = Date.now();
    // If a response overview has been sent in this chat...
    if (chat_id in responses) {
        // ... and it is NOT older than the cooldown interval, ignore it.
        if (current_time < responses[chat_id].timestamp + COOLDOWN_MS) {
            return empty_response;
        }
        // ... and it is older than the cooldown interval, prepare for new response overview.
        // Deactivate inline keyboards for the last response overview
        let message = get_response_message(chat_id);
        let opts = {
            reply_markup: undefined,
            parse_mode: /**@type {TelegramBot.ParseMode} */ ('HTML'),
            message_id: responses[chat_id].last_message_id,
            chat_id: chat_id
        };
        await edit_callback(message, opts);

        if (PIN_MESSAGES) {
            unpin_callback(chat_id, responses[chat_id].last_message_id);
        }

        responses[chat_id].timestamp = current_time;
        responses[chat_id].responses = [];
    }
    // If no response overview has been sent in this chat, create a new one.
    else {
        let response = {
            'chat_id': chat_id,
            'timestamp': current_time,
            'last_message': "",
            'last_message_id': 0,
            'responses': [],
            'last_react': 0,
            'job': null,
            'hanging_job_callbacks': []
        }
        responses[chat_id] = response;
    }

    log.debug(`Creating/Updating response overview for ${chat_id}`);

    let msg = get_response_message(chat_id);

    /**@type {TelegramBot.SendMessageOptions} */
    let opts = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "Vor Ort",
                    callback_data: "accept#0"
                },
                {
                    text: "5min",
                    callback_data: "accept#5"
                },
                {
                    text: "10min",
                    callback_data: "accept#10"
                }],
                [{
                    text: "15min",
                    callback_data: "accept#15"
                },
                {
                    text: "20min",
                    callback_data: "accept#20"
                },
                {
                    text: ">20min",
                    callback_data: "accept#21"
                }],
                [{
                    text: "Komme nicht",
                    callback_data: "reject"
                }],
            ]
        },
        parse_mode: 'HTML'
    };
    //TODO: Timeout?
    let res = await send_callback(chat_id, msg, 60 * 1000, opts);
    if (PIN_MESSAGES) {
        pin_callback(chat_id, res.msg_id);
    }
    if(res.success){
        responses[chat_id].last_message_id = res.msg_id;
    }
    return res;
}