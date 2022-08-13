"use strict";
import winston from 'winston';
import loggers from '../logging.mjs'

import TelegramBot from 'node-telegram-bot-api';
import * as bot from './bot.mjs';

/** @type {MessageTask[]} */
let queue = [];

/** @type {boolean} */
let active = false;

/**@type {winston.Logger} */
let log;

/** @type {boolean} */
let lock_inactive = false;

export function init() {
    log = loggers("TelegramQueue");
}

/**
 * Callback type for queue action.
 * @callback queue_callback
 * @param {number} chat_id ID of the chat that the message will be sent to.
 * @param {string} message Text content to send.
 * @param {TelegramBot.SendMessageOptions} opts Message options (keyboards, etc.).
 * @return {Promise<bot.bot_response>}
 */

/**
 * Callback type for result propagation.
 * @callback queue_result_callback
 * @param {Promise<bot.bot_response>} result
 */

class MessageTask {

    /**
     * 
     * @param {queue_callback} callback 
     * @param {number} recipient 
     * @param {String} message 
     * @param {TelegramBot.SendMessageOptions} opts 
     * @param {number} timeout 
     */
    constructor(callback, recipient, message, opts, timeout) {
        this.callback = callback;
        this.chat_id = recipient;
        this.message = message;
        this.opts = opts;
        this._timeout = this.calculate_timeout(timeout);

        this.res_callback = null;
    }

    get timeout() {
        return this._timeout;
    }

    get alive() {
        return this.timeout > Date.now();
    }

    /**
     * 
     * @param {queue_result_callback} res_callback 
     */
    set_result_callback(res_callback) {
        this.res_callback = res_callback;
    }

    /**
     * 
     * @param {number} timediff 
     * @returns {number} The timout time given the time difference
     */
    calculate_timeout(timediff) {
        //timediff is ms
        return Date.now() + timediff;
    }

    /**
     * Perform send task by passing set parameters to callback function.
     * @returns {Promise<bot.bot_response>}
     */
    send() {
        const res = this.callback(this.chat_id, this.message, this.opts);

        if (this.res_callback) {
            this.res_callback(res);
        }
        return res
    }
}

/**
 * Queue a message to be sent.
 * @param {queue_callback} callback: Callback for sending the message.
 * @param {number} recipient: Chat ID to send message to.
 * @param {String} message: The message content.
 * @param {TelegramBot.SendMessageOptions} opts: Message markup options.
 * @param {number} timeout: The last point in time at which the message should be delivered. Message is lost if timeout is hit.
 * @returns {Promise<bot.bot_response>}: A promise that will resolve with the callbacks response once the task is executed in the queue.
 */
export function add(callback, recipient, message, opts, timeout) {


    log.silly(`Enqueued message: ${message}`)
    let task = new MessageTask(callback, recipient, message, opts, timeout);

    /**@type {Promise<{success: boolean, resend: boolean, msg_id: number}>} */
    let res_promise = new Promise((resolve) => {
        task.set_result_callback(async function (result) {
            resolve(await result);
        });
    });

    queue.push(task);
    if (!active) {
        step();
    }

    return res_promise;
}


    /**
     * Restart the queue if it is in a stopped state. This should typically be called after an error was fixed.
     */
function relaunch() {
    if (lock_inactive || !active) {
        lock_inactive = false;
        step();
    }
}

/**
 * Stop teh queue and lock inactive for defined time.
 * @param {number} pause_time_ms 
 */
export function pause(pause_time_ms) {
    lock_inactive = true;

    setTimeout(relaunch, pause_time_ms); //Restart queue after quiet period
}

    /**
     * Check for available items in queue. If queue is not empty start/continue processing tasks. 
     */
async function step() {
    active = true;
    if (queue.length < 1 || lock_inactive) {
        //Nothing to do
        active = false;
        return;
    } else {
        // we now that it can't by "undefined" as we check that the queue has at least a single element
        let task = queue.shift();
        if (!task?.alive) {
            log.warn(`Message "${task?.message}" timed out and will be removed from queue without sending.`);
        } else {
            let res = null;
            try {
                res = await task.send();
            } catch (error) {
                log.error("An unexpected error occurred while sending message:" + error);
                log.error("This is typically due to an implementation error. Will remove message from queue without beeing sent and stop queue execution.");
                active = false;
                return;
            }

            if (res != null && res.resend) {
                //Task did not complete we have a problem -- this will be handled at the source of the problem
                log.warn("Message could not be sent. Rescheduling.");
                queue.unshift(task);
            }
            if (!res.success && !res.resend) {
                log.error("Message could not be sent. NOT rescheduling.");
            }
        }
    }
    //Perform next queue step if everything is fine to go...
    setTimeout(step, 500); //Delay for 500ms to avoid triggering flood errors
}

    /**
     * Silently clear the complete queue.
     */
export function clear() {

    lock_inactive = true;
    active = false;

    if (queue.length > 0) {
        log.warn("Clearing message queue. Removed task count: " + queue.length);
        queue = [];
    }
}