"use strict";
import * as winston from 'winston'
import TelegramTransport from './telegramTransport.mjs';

import * as DB from './db.mjs'
import * as telegram_bot from './telegram/bot.mjs';

//This is a little hacky for my liking
/**
 * 
 * @param {any} chat_id_callback 
 * @param {typeof telegram_bot.queue_message} bot_queue_callback 
 */
export function connect_telegram_transport(chat_id_callback, bot_queue_callback){
    winston.loggers.loggers.forEach(logger => {
        logger.add(new TelegramTransport(chat_id_callback, bot_queue_callback));
    });
}

let LOG_LEVEL = "silly";

/**
 * 
 * @param {String} level  - The log level
 */
export function set_logging_level(level){
    LOG_LEVEL = level;
}

const pbConsoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    // winston.format.label({label: "PagerBuddy"}),
    winston.format.timestamp({ format: "DD.MM.YYYY HH:mm:ss" }),
    winston.format.splat(),
    // winston.format.align(),
    winston.format.printf((info) => `${info.timestamp} [${info.label}] ${info.level}: ${info.message} `)
)


// Winston is weird, one can not define a logger and then add it to `winston.loggers` using 
// the `add` method. One has to create the added logger on-the-fly leading to this super stupid
// code duplication.

/**
 * Creates a new labeled (i.e. named) logger
 * @param {String} label - The label for the logger
 * @returns {winston.Logger} The newly created logger
 */
export default function mkLogger(label) {
    let loggerName = `${label.toLowerCase()}Logger`
    winston.loggers.add(loggerName, {
        level: LOG_LEVEL,
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.label({ label: label }), pbConsoleFormat),
                stderrLevels: ['error', 'warn']
            })
        ]
    })
    return winston.loggers.get(loggerName)
}