"use strict";

/**
 * This modules handles the Telegram Bot.
 */

import './envVariables.mjs'; //This must be imported before the bot-api!
import TelegramBot from 'node-telegram-bot-api';

import loggers from '../logging.mjs'
import * as  queue from './queue.js';
import * as response_overview from './response-overview.js';
import winston from 'winston';

import * as mydata from '../data.js'
import * as myhealth from '../health.mjs'
import * as mymessaging from '../messaging.mjs'

/** @type {String } */
let BOT_NAME = "";
/** @type {String } */
let BOT_TOKEN = "";
/** @type {String } */
let TIMEZONE = "";

/** @type {number[]} */
let TELEGRAM_ADMIN_GROUPS = [];

/** @type {mydata} */
let data;

/** @type {winston.Logger} */
let log;
/** @type {myhealth} */
let health;
/** @type {mymessaging} */
let messaging;

/** @type {TelegramBot} */
var bot;

/** 
 * A well-formated bot action response.
 * @typedef {Object} bot_response
 * @property {boolean} success
 * @property {boolean} resend
 * @property {number} msg_id
*/

/**
 * 
 * @param {mydata} db 
 * @param {{bot_token: string, bot_name: string, admin_groups: number[], response_overview: response_overview.response_overview_config}} bot_config 
 * @param {string} timezone 
 * @param {myhealth} health_ 
 * @param {mymessaging} msgs 
 */
export function init(db, bot_config, timezone, health_, msgs) {
    log = loggers("TelegramBot");
    BOT_NAME = bot_config.bot_name;
    BOT_TOKEN = bot_config.bot_token;
    TIMEZONE = timezone;
    TELEGRAM_ADMIN_GROUPS = bot_config.admin_groups;
    data = db;
    health = health_;
    messaging = msgs;

    queue.init();
    response_overview.init(bot_config.response_overview, timezone, queue_edit, queue_message, pin_message, unpin_message);
}

/**
 * Extract an embedded shortform - syntax: "(shorttext)"
 * @param {string} text
 * @returns {string} The extracted shortform of unit, or the original string.
 */
function minimize_text(text) {
    let match = text.match(/\((.*)\)/);

    if (match == null) {
        return text;
    }

    return match[1];
}

/**
 * Add a message to be sent in the message queue. Use only THIS externally for system messages.
 * Note that the order of timeout is different - this is because default parameter values apparently have to be the last parameters.
 * @param {number} chat_id: The receiver of the message.
 * @param {string} message: The message content.
 * @param {number} timeout: Time in ms to maximally wait for delivery before message is removed from queue.
 * @param {TelegramBot.SendMessageOptions} opts: Message options.
 * @returns {Promise<bot_response>}: The send_message reponse received once the task is reached in the queue.
 */
export async function queue_message(chat_id, message, timeout, opts = {}) {
    if (!opts.parse_mode) {
        opts.parse_mode = 'HTML';
        opts.disable_web_page_preview = true;
    }

    return await queue.add(send_message_with_opts, chat_id, message, opts, timeout);
}


/**
 * Add a message to be edited. CAUTION; This is currently a placeholder and does not actually use the queue!
 * Note that the order of timeout is different - this is because default parameter values apparently have to be the last parameters.
 * @param {String} message: The message content.
 * @param {TelegramBot.EditMessageTextOptions} opts: Message options. Must be specified!
 * @param {number} timeout: Time in ms to maximally wait for delivery before message is removed from queue.
 * @returns {Promise<bot_response>}: The edit_message response.
 */

export async function queue_edit(message, opts, timeout = 120 * 1000) {
    //TODO: Actually implement this in the message queue

    return await send_message_edit(message, opts);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id
 * @return {Promise<boolean>} Success 
 */
export async function pin_message(chat_id, message_id) {
    try {
        let me = await bot.getMe();
        let me_chat_member = await bot.getChatMember(chat_id, me.id.toString());
        if (me_chat_member != null && me_chat_member.can_pin_messages) {
            // @ts-ignore -- ts for this call seems to have wrong markup without [options]
            bot.pinChatMessage(chat_id, message_id, { disable_notification: true });
        }
    } catch (/** @type {any}*/ error) {
        log.warn("Bot could not pin a message. Error: " + error.message);
        return false;
    }
    return true;
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @return {Promise<boolean>} Success 
 */
export async function unpin_message(chat_id, message_id) {
    try {
        let me = await bot.getMe();
        let me_chat_member = await bot.getChatMember(chat_id, me.id.toString());
        if (me_chat_member != null && me_chat_member.can_pin_messages) {
            await bot.unpinChatMessage(chat_id, message_id);
        }
    } catch (/** @type {any}*/ error) {
        log.warn("Bot could not unpin a message. Error: " + error.message);
        return false;
    }
    return true;
}

/**
 * Send an alert to the provided chat id. A message string is built from the provided parameters.
 * @param {number} chat_id: The receiver of the message.
 * @param {number} zvei_id: The alert id.
 * @param {String} description: The description of the alert type ("") if none.
 * @param {Boolean} is_test_alert: Wether we are currently in test alert time.
 * @param {number} timestamp: The alert timestamp (typically provided from alert device.) in Unix time as ms.
 * @param {Boolean} is_manual: If the alert was triggered manually.
 * @param {String} text: Alert content - can be arbitrary text.
 * @return {Promise<{msg_res: PromiseSettledResult<bot_response>, resp_res: PromiseSettledResult<bot_response>}>}
 */
export async function send_alert(chat_id, zvei_id, description, is_test_alert, timestamp, is_manual, text) {
    //We have to ensure chat_id is a numeric type.
    //let chat_id_as_number = parseInt(chat_id);

    let alert_text = "";

    if (is_manual) {
        alert_text += "<b>Manueller Alarm (KEINE ILS)</b>\n";
    } else if (is_test_alert) {
        alert_text += "<b>Probealarmzeit</b>\n";
    }
    alert_text += text + '\n'
    alert_text += description + "\n<code>";
    alert_text += zvei_id + "\n";

    let datetime = new Date(timestamp);
    const timeString = datetime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TIMEZONE });
    const dateString = datetime.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TIMEZONE });

    alert_text += timeString + " " + dateString + "</code>";
    alert_text += `\n\n<a href='http://bartunik.de/pagerbuddy'>PagerBuddy</a>`;

    const msg_promise = queue_message(chat_id, alert_text, 1000 * 60 * 2); //Give alerts max. 2 min for delivery
    const resp_promise = response_overview.create_response_overview(chat_id, is_test_alert);

    let [msg_res, resp_res] = await Promise.allSettled([msg_promise, resp_promise]);
    return { msg_res, resp_res };
}


/**
 * Send a message with opts (typically an inline keyboard) to a chat. This should only be used directly for admin request, as not queued.
 * @param {number} chat_id ID of the chat that the message will be sent to.
 * @param {string} message Text content to send.
 * @param {TelegramBot.SendMessageOptions} opts Message options (keyboards, etc.).
 * @return {Promise<bot_response>}
 */
async function send_message_with_opts(chat_id, message, opts) {

    if (bot == null) {
        log.error("Bot not initialised. Cannot send message.")
        return { success: false, resend: true, msg_id: 0 };
    }

    if (message == null || message.length < 1) {
        //We cannot send empty message
        log.warn("Attempted to send an empty message. Will remove unsent message from queue.");
        return { success: false, resend: false, msg_id: 0 };
    }

    if (chat_id == null || chat_id == 0) {
        //We need a valid chat id
        log.warn("Attempted to send a message to an empty chat id. Will remove unsent message from queue.");
        return { success: false, resend: false, msg_id: 0 };
    }
    var sent_message = null
    try {
        // TODO should we really await here?
        sent_message = await bot.sendMessage(chat_id, message, opts);
    } catch (error) {
        return bot_error_send(error);
    }
    health.telegram_status(true);
    return { success: true, resend: false, msg_id: sent_message.message_id };
}


    /**
     * Sends the list of groups with an inline keyboard and callbacks.
     * @param {number} chat_id Receiver of the list.
     */
async function reply_group_list(chat_id) {


    let rows = await data.get_groups();

    let opts = { 
        reply_markup: {  
            /** @type {Array<Array<{text: string, callback_data: string}>>} */ inline_keyboard: [] 
        } 
    };

    let msg = "Select a Group:";

    for (let i in rows) {
        let label = rows[i].group_id + ": " + rows[i].description;
        let id = "group#" + rows[i].group_id + "#";

        let row = {
            text: label,
            callback_data: id
        }
        opts["reply_markup"]["inline_keyboard"].push([row]);
    }

    queue_message(chat_id, msg, 120 * 1000, opts);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @param {number} group_id 
 */
async function reply_edit_group(chat_id, message_id, group_id) {
    let details = await data.get_group_details(group_id);
    let msg = `Group <b>${details[0].description}</b> \nChat ID: ${details[0].chat_id} \nToken: ${details[0].auth_token} \nWhat do you want to do?`;

    let prefix = "group_edit#" + group_id + "#";

    let opts = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "Add ZVEI",
                    callback_data: prefix + "linkadd"
                }],
                [{
                    text: "Remove ZVEI",
                    callback_data: prefix + "linkdel"
                }],
                [{
                    text: "Delete",
                    callback_data: prefix + "del"
                }]
            ]
        },
        parse_mode: /**@type {TelegramBot.ParseMode} */ ('HTML'),
        message_id: message_id,
        chat_id: chat_id
    };

    queue_edit(msg, opts);
}


    /**
     * Sends the list of ZVEIs as a message update to select ZVEI for linking.
     * @param {number} chat_id Receiver of the list.
     * @param {number} message_id
     * @param {number} group_id
     */
async function reply_group_zvei_list(chat_id, message_id, group_id) {


    let rows = await data.get_zvei();

    let opts = { 
        message_id: message_id, 
        chat_id: chat_id,
        reply_markup: {
            /** @type {{text: string, callback_data: string}[][]} */ inline_keyboard: []
        }
    };

    let msg = "Select a ZVEI to link:";

    let prefix = "group_link_zvei#" + group_id + "#";

    for (let i in rows) {
        let label = rows[i].zvei_id + ": " + minimize_text(rows[i].description);
        let id = prefix + rows[i].zvei_id + "#";

        let row = {
            text: label,
            callback_data: id
        }
        opts["reply_markup"]["inline_keyboard"].push([row]);
    }

    queue_edit(msg, opts);
}


    /**
     * Sends the list of ZVEIs as a message update to select ZVEI for unlinking.
     * @param {number} chat_id Receiver of the list.
     * @param {number} message_id
     * @param {number} group_id
     */
async function reply_group_current_zvei_list(chat_id, message_id, group_id) {


    let rows = await data.get_group_alarms(group_id);

    let opts = { 
        message_id: message_id, 
        chat_id: chat_id,
        reply_markup: {
            /** @type {Array<Array<{text: string, callback_data: string}>>} */ inline_keyboard: []
        }
    };

    let msg = "Select a ZVEI to unlink:";

    let prefix = "group_unlink_zvei#" + group_id + "#";

    for (let i in rows) {
        let label = rows[i].zvei_id + ": " + minimize_text(rows[i].description);
        let id = prefix + rows[i].zvei_id + "#";

        let row = {
            text: label,
            callback_data: id
        }
        opts["reply_markup"]["inline_keyboard"].push([row]);
    }

    queue_edit(msg, opts);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @param {number} group_id 
 * @param {number} zvei_id 
 */
async function unlink_group_zvei(chat_id, message_id, group_id, zvei_id) {
    await data.remove_alarm(zvei_id, group_id);

    let msg = `Unlinked group ${group_id} and ZVEI ${zvei_id}.`;

    let opts = {
        message_id: message_id,
        chat_id: chat_id
    }

    queue_edit(msg, opts);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @param {number} group_id 
 * @param {number} zvei_id 
 */
async function link_group_zvei(chat_id, message_id, group_id, zvei_id) {
    await data.add_alarm(zvei_id, group_id);

    let msg = `Linked group ${group_id} to ZVEI ${zvei_id}.`;

    let opts = {
        message_id: message_id,
        chat_id: chat_id
    }

    queue_edit(msg, opts);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @param {number} group_id 
 */
async function delete_group(chat_id, message_id, group_id) {
    await data.remove_group(group_id);

    let msg = `Deleted group ${group_id}.`;

    let opts = {
        message_id: message_id,
        chat_id: chat_id
    }

    queue_edit(msg, opts);
}


    /**
     * Sends the list of ZVEIs with an inline keyboard and callbacks.
     * @param {number} chat_id Receiver of the list.
     */
async function reply_zvei_list(chat_id) {


    let rows = await data.get_zvei();

    let opts = { 
        reply_markup: {
            /** @type {Array<Array<{text: string, callback_data: string}>>} */ inline_keyboard: []
        }
    };

    let msg = "Select a ZVEI:";

    for (let i in rows) {
        let label = rows[i].zvei_id + ": " + minimize_text(rows[i].description);
        let id = "zvei#" + rows[i].zvei_id + "#";

        let row = {
            text: label,
            callback_data: id
        }
        opts["reply_markup"]["inline_keyboard"].push([row]);
    }

    queue_message(chat_id, msg, 120 * 1000, opts)
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @param {number} zvei_id 
 */
async function delete_zvei(chat_id, message_id, zvei_id) {
    await data.remove_zvei(zvei_id);

    let msg = `Deleted ZVEI ${zvei_id}.`;

    let opts = {
        message_id: message_id,
        chat_id: chat_id
    }

    queue_edit(msg, opts);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} message_id 
 * @param {number} zvei_id 
 */
async function edit_zvei(chat_id, message_id, zvei_id) {
    let description = await data.get_zvei_details(zvei_id);
    let msg = `ZVEI ${description} \n What do you want to do?`;

    let prefix = "zvei_edit#" + zvei_id + "#";

    let opts = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "Delete",
                    callback_data: prefix + "del"
                }]
            ]
        },
        message_id: message_id,
        chat_id: chat_id
    };


    queue_edit(msg, opts);

}
/**
 * 
 * @param {number} chat_id 
 * @param {string} group_description 
 */
async function add_group(chat_id, group_description) {
    let auth_token = await data.add_group(group_description);
    const msg = `Added new group <b>${group_description}</b>`;
    queue_message(chat_id, msg, 120 * 1000);

    let deep_link = `<a href='https://t.me/${BOT_NAME}?startgroup=${auth_token}'>Authenticate ${group_description}</a>`;
    const msg2 = `Authentication token: <b>${auth_token}</b>\nYou can use this link to authenticate PagerBuddy-Server in a chat group: ${deep_link}`;
    queue_message(chat_id, msg2, 120 * 1000);
    reply_group_list(chat_id);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} zvei_id 
 * @param {string} zvei_description 
 */
async function add_zvei(chat_id, zvei_id, zvei_description) {
    await data.add_zvei(zvei_id, zvei_description, 2, "19:55", "20:30");
    const msg = `Added ZVEI <b>${zvei_id}</b> with default test time filter.`;
    queue_message(chat_id, msg, 120 * 1000);
}

    /**
     * Edit an existing message.
     * @param {string} message The new metruessage text.
     * @param {TelegramBot.EditMessageTextOptions} opts The message options. Must contain reference to previous message to edit.
     * @returns {Promise<bot_response>} If sending the message was successfull.
     */
async function send_message_edit(message, opts) {


    if (bot == null) {
        log.error("Bot not initialised. Cannot send message.")
        return {success: false, resend: true, msg_id: 0};
    }

    let msg_id = 0;
    try {
        //boolean is only returned for inline messages
        let res = /**@type {TelegramBot.Message} */ (await bot.editMessageText(message, opts));
        msg_id = res.message_id;
    } catch (/** @type {any} */ error) {
        if (error.response.body.error_code == 400) {
            //Message has probably gone away
            log.debug("Could not send message edit. Message was probably deleted");
            //TODO: Perhaps test this in the future and probe a more precise error
            return {success: false, resend: false, msg_id: 0};
        } else {
            log.error("Error trying to edit message.");
            return bot_error_send(error);
        }
    }
    health.telegram_status(true);
    return {success: true, resend: false, msg_id: msg_id};
}

/**
 * 
 * @param {number} chat_id 
 * @returns  {Promise<boolean>} Whether the chat id is an admin chat or not
 */
async function is_admin_chat(chat_id) {
    return TELEGRAM_ADMIN_GROUPS.includes(chat_id);
}

    /**
     * Remove all user subscriptions that are not valid anymore. This should be called regularly.
     */
export async function remove_invalid_user_subscriptions() {

    log.debug("Checking all user DB entries for invalid subscriptions.");
    let list = await data.get_check_users_list();

    let count = 0;
    for (let id in list) {
        if (!await is_chat_member(parseInt(list[id].chat_id), list[id].user_id)) {
            data.remove_user_link(list[id].user_id, list[id].group_id); //Do not await this to speed up stuff.
            count++;
        }
    }
    log.debug(`Removed ${count} invalid subscriptions.`);
}

/**
 * The chat id of a Telegram channel can change. This typically hapens when a regular group changes to a supergroup.
 * The new chat id is typically returned in a migration error.
 * This updates the db entries to contain the new chat id.
 * @param {number} old_chat_id Obsolete chat id as found in the databse.
 * @param {number} new_chat_id New chat id which should be the destination of future requests.
 * @return {Promise<boolean>} Success
 */
async function migrate_chat_id(old_chat_id, new_chat_id) {
    return await data.replace_chat_id(old_chat_id, new_chat_id);
}

/**
 * 
 * @param {number} chat_id 
 * @param {number} user_id Telegram user id
 * @returns {Promise<boolean>} If user is an active chat member. False on error 
 */
async function is_chat_member(chat_id, user_id) {
    //Check if the given user is a member of the provided chat
    //Use this to validate PagerBuddy-App subscriptions

    try {
        let user = await bot.getChatMember(chat_id, user_id.toString());
        log.silly("User chat status: " + user.status);
        return user.status == "creator" || user.status == "administrator" || user.status == "member" || user.status == "restricted";
    } catch (/** @type {any} */ error) {
        if (error.code == "ETELEGRAM" && error.response.body.error_code == 400) {
        } else {
            bot_error_send(error);
        }
        return false;
    }
}

/**
 * @param {number} user_id User ID.
 * @param {string} token FCM or APNS token.
 * @param {number[]} chat_ids List of chat IDs to which the user wants to subscribe.
 */
async function subscribe(user_id, token, chat_ids) {

    //Start by clearing user from DB
    await data.remove_user(user_id);

    if (chat_ids.length < 1) {
        //Empty list: The user has unsubscribed all ids - do not add him again
        return;
    }

    await data.update_user(user_id, token);

    let group_id = null;
    for (let i in chat_ids) {
        let permission = await is_chat_member(chat_ids[i], user_id);
        if (!permission) {
            log.debug("A user requested alerts without beeing a group member.");
            continue;
        } else {
            // Get group ID from chat ID
            group_id = await data.get_group_id_from_chat_id(chat_ids[i]);
            // Link the user to the group
            await data.add_user_group(user_id, group_id);
        }
    }
}

    /** Handle bot errors that occur on message send
     * @param {any} error The error message.
     * @returns {bot_response} If a sent message should be requeued.
     */
function bot_error_send(error) {


    //TODO: (ONGOING) Add handlers and strategies for occuring errors

    let resend = true;

    if (error.code == "ETELEGRAM") {
        switch (error.response.body.error_code) {
            case 400:
                //The request is malformed. Log this and remove request from list
                if (error.response.body.parameters?.migrate_to_chat_id) {
                    //Chat ID is obsolete - update with new ID
                    const req_body = error.response.request.body;
                    const old_id = req_body.match(/(?<=&chat_id=)(-?[0-9]+)(?=&)/)[0];
                    let new_id = error.response.body.parameters.migrate_to_chat_id.toString();
                    log.error("Could not send message. Chat migrated to new ID. Will update database with new chat id for future requests.");
                    migrate_chat_id(old_id, new_id);
                } else {
                    log.error("Malformed telegram request. Removing unsent message. This is probably an implementation fault! Error: " + error.message);
                }
                resend = false;
                break;
            case 403:
                //Forbidden
                //We have been blacklisted/removed from chat.
                log.warn("Telegram sent us a forbidden error. Probably the bot was blocked by the user. Removing unsent message from queue. Error: " + error.message);
                resend = false;
                break;
            case 420:
            case 429:
                //Flood
                //Halt the queue and wait specified time before next call.
                let retry_delay = error.response.body.parameters.retry_after;
                queue.pause(retry_delay * 1000);
                log.warn(`Telegram sent us a flood error. We have to wait ${retry_delay}s before the next request. Error: ` + error.message);
                break;
            case 500:
            case 502:
                //Telegram server error
                queue.pause(10 * 1000); //Pause queue before next retry attempt.
                log.debug("Telegram has an internal server error. We will have to wait for the problem to be fixed. Error: " + error.message);
                health.telegram_status(false);
                break;
            default:
                log.error("Unexpected error from Telegram: " + error);
        }

    } else if (error.code == "EFATAL") {
        queue.pause(10 * 1000); //Pause queue before next retry attempt.
        log.error("Fatal error in telegram bot: " + error);
    } else if (error.code == "EPARSE") {
        queue.pause(10 * 1000); //Pause queue before next retry attempt.;
        log.error("Parse error in telegram bot: " + error);
    } else {
        log.error("An unkown error occurred in telegram bot: " + error);
    }
    return {success: false, resend: resend, msg_id: 0 };
}

/**
 * 
 * @param {any} error 
 */
function bot_error_operation(error) {
    //This should already be reported on send events
    log.debug(error.message);
}


export function start_bot() {
    log.debug("Starting up Telegram Bot.");

    bot = new TelegramBot(BOT_TOKEN, {
        polling: true,
        onlyFirstMatch: true
    });

    bot.on("error", bot_error_operation);
    bot.on("polling_error", bot_error_operation)

    bot.onText(new RegExp(`(?<=^\\/subscribe)(?:@${BOT_NAME})?\\s+[A-Za-z0-9\\+\\/=]+\\s*$`), async function (msg, match) {
        let user_id = msg.from?.id
        if(!user_id || !match){
            return;
        }

        /**@type {{token: string, alert_list: number[]}} */
        let subscription = JSON.parse(Buffer.from(match[0], 'base64').toString('ascii'));
        if (subscription != null && subscription.token != null && subscription.alert_list != null) {
            log.debug(`User subscription - ID: ${user_id}, alert list: ${subscription.alert_list}`);
            subscribe(user_id, subscription.token, subscription.alert_list);
        } else {
            log.debug("An invalid user subscription request was received.");
        }
    });

    //User requests FCM test in app
    bot.onText(new RegExp(`^\\/testalert(?:@${BOT_NAME})?\\s*$`), async function (msg, match) {
        const user_id = msg.from?.id;
        if(!user_id){
            return;
        }
        const token = await data.user_token(user_id);
        const chat_ids = await data.user_chat_ids(user_id);

        if (token.length < 1 || chat_ids.length < 1) {
            log.debug("User requested test without beeing registered for an alert.");
            return;
        } else {
            log.debug("Sending FCM test to user.");
        }

        messaging.sendTest(token, chat_ids[0], user_id);
    });

    //Match auth scenario - only with valid token args to avoid DDoS attractiveness
    bot.onText(new RegExp(`^\\/(?:auth|start)(?:@${BOT_NAME})?\\s+([A-Za-z0-9]{10})\\s*$`), async function (msg, match) {
        if(!match){
            return;
        }
        let token = match[1];

        let response = '';
        let groupID = await data.authenticate_group(msg.chat.id, token);
        if (groupID != -1) {
            let zveis = await data.get_zvei_ids_for_group(groupID);
            response = `You have successfully authenticated this chat and will receive alerts for following alert sequences: ${zveis}`;
        } else {
            response = "Could not authenticate chat. Either the authentication token is invalid or this chat is already registered for an alert group.";
        }
        queue_message(msg.chat.id, response, 1000 * 60 * 10);
    });

    bot.on("callback_query", async (callbackQuery) => {
        if(!callbackQuery.data) return;
        if(!callbackQuery.message) return;

        let zvei_match = callbackQuery.data.match(/#([0-9]{1,5})#/);
        let zvei_id = 0;
        if(zvei_match){
            zvei_id = parseInt(zvei_match[1]);
        }
        let chat_id = callbackQuery.message.chat.id;;

        let group_id = 0;
        let group_match = callbackQuery.data.match(/#([0-9]+)#/);
        if(group_match){
            group_id = parseInt(group_match[1]);
        }
        
        switch (true) {
            case /^zvei#[0-9]{1,5}#/.test(callbackQuery.data):
                await edit_zvei(chat_id, callbackQuery.message.message_id, zvei_id);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^zvei_edit#[0-9]{1,5}#del/.test(callbackQuery.data):
                await delete_zvei(chat_id, callbackQuery.message.message_id, zvei_id);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^group#[0-9]+#/.test(callbackQuery.data):
                await reply_edit_group(chat_id, callbackQuery.message.message_id, group_id)
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^group_edit#[0-9]+#del/.test(callbackQuery.data):
                await delete_group(chat_id, callbackQuery.message.message_id, group_id)
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^group_edit#[0-9]+#linkdel/.test(callbackQuery.data):
                await reply_group_current_zvei_list(chat_id, callbackQuery.message.message_id, group_id);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^group_edit#[0-9]+#linkadd/.test(callbackQuery.data):
                await reply_group_zvei_list(chat_id, callbackQuery.message.message_id, group_id);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^group_link_zvei#[0-9]+#[0-9]{1,5}#/.test(callbackQuery.data):
                let zvei_match = callbackQuery.data.match(/#[0-9]+#([0-9]+)#/);
                if(!zvei_match) return;
                zvei_id = parseInt(zvei_match[1]);
                chat_id = callbackQuery.message.chat.id;
                await link_group_zvei(chat_id, callbackQuery.message.message_id, group_id, zvei_id);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^group_unlink_zvei#[0-9]+#[0-9]{1,5}#/.test(callbackQuery.data):
                let zvei_match2 = callbackQuery.data.match(/#[0-9]+#([0-9]+)#/);
                if(!zvei_match2) return;
                zvei_id = parseInt(zvei_match2[1]);
                chat_id = callbackQuery.message.chat.id;
                await unlink_group_zvei(chat_id, callbackQuery.message.message_id, group_id, zvei_id);
                await bot.answerCallbackQuery(callbackQuery.id);
                break;

            case /^accept#[0-9]+/.test(callbackQuery.data):
                await response_overview.respond(callbackQuery, true);
                try {
                    await bot.answerCallbackQuery(callbackQuery.id);
                } catch (error) {
                    // This can take too long and timeout
                }

                break;

            case callbackQuery.data == "reject":
                await response_overview.respond(callbackQuery, false);
                try {
                    await bot.answerCallbackQuery(callbackQuery.id);
                } catch (error) {
                    // This can take too long and timeout
                }
                break;
        }

    });

    bot.onText(/^\/.+/, async function (msg, match) {
        let text = msg.text;
        if(!text) return;
        let args = text.split(' ');
        // First argument is the command itself, remove it
        args.shift();
        let permission = await is_admin_chat(msg.chat.id);
        let rows = [];
        let response = '';

        switch (true) {
            case !permission:
                //No response (DDoS)
                return;
            case /\/help/.test(text):
                response = `
            /zveiList: Show all ZVEI units.
            /addZVEI &lt;zvei_id&gt &lt;description&gt: Add a new ZVEI unit.

            /groupList: Show all groups.
            /addGroup &lt;description&gt: Add a new group.

            /health: Show an interface health report.
            /backup: Make a copy of the DB.
             `;
                break;

            case (new RegExp(`^\\/zveiList(?:@${BOT_NAME})?`)).test(text):
                await reply_zvei_list(msg.chat.id);
                return;

            case (new RegExp(`^\\/addZVEI(?:@${BOT_NAME})?\\s[0-9]{1,5}\\s([\\wäÄöÖüÜß()\\-\\s]+)`)).test(text):
                let matches1 = text.match(new RegExp(`\\/addZVEI(?:@${BOT_NAME})?\\s[0-9]{1,5}\\s([\\wäÄöÖüÜß()\\-\\s]+)`));
                if(!matches1) return;
                let zvei_description = matches1[1];
                let matches2 = text.match(new RegExp(`\\/addZVEI(?:@${BOT_NAME})?\\s([0-9]{1,5})\\s`));
                if(!matches2) return;
                let zvei_id = parseInt(matches2[1]);
                await add_zvei(msg.chat.id, zvei_id, zvei_description);
                return;

            case (new RegExp(`^\\/groupList(?:@${BOT_NAME})?`)).test(text):
                await reply_group_list(msg.chat.id);
                return;

            case (new RegExp(`^\\/addGroup(?:@${BOT_NAME})?\\s([\\wäÄöÖüÜß()\\-\\s]+)`)).test(text):
                let matches3 = text.match(new RegExp(`\\/addGroup(?:@${BOT_NAME})?\\s([\\wäÄöÖüÜß()\\-\\s]+)`));
                if(!matches3) return;
                let group_description = matches3[1];
                await add_group(msg.chat.id, group_description);
                return;

            case (new RegExp(`^\\/backup(?:@${BOT_NAME})?`)).test(text):
                //backup.perform_backup();
                response = "Backup is currently not implemented...";
                break;

            case (new RegExp(`^\\/health(?:@${BOT_NAME})?`)).test(text):
                response = health.get_health_report();
                break;

            default:
                response = "Unknown command or unexpected arguments. Use /help to see the list of available commmands.";
                break;
        }
        queue_message(msg.chat.id, response, 1000 * 60 * 10);
    });

    //Do nothing with regular messages
    bot.onText(/.+/, async function (msg, match) { });
}

export async function stop_bot() {
    /**
     * Cleanly empty queue and stop bot.
     */


    queue.clear();
    await bot.stopPolling({ cancel: true });
    try {
        await bot.close();
    } catch (/** @type {any} */ error) {
        if (error?.response?.statusCode == 429) {
            //This is a standard flood error if bot is closed within 10min of opening - ignore
        } else {
            log.warn("Error stopping bot: " + error.message);
        }
    }

    queue.clear();
}
