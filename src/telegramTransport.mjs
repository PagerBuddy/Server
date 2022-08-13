'use strict'

import * as winston from 'winston';
import Transport from 'winston-transport';

import * as data from './data.js';
import * as telegram_bot from './telegram/bot.mjs';

const MESSAGE = Symbol.for('message')
const LEVEL = Symbol.for('level')


// TODO das hier über winston.levels holen
/**@type {Object.<typeof LEVEL, number>} */
const levelToZVEI = { 'silly': 0, 'debug': 1, 'info': 2, 'warn': 3, 'error': 4 };

const pbTelegramFormat = winston.format.combine(
    // winston.format.label({label: "PagerBuddy"}),
    winston.format.timestamp({ format: "DD-HH:mm:ss" }),
    winston.format.splat(),
    // winston.format.align(),
    winston.format.printf((info) => `${info.timestamp} | ${info.level}: ${info.message} `)
);

export default class TelegramTransport extends Transport {

    //Theoretically we could pass the whole format here, but I (Max) quite like the compact format for Telegram

    /**
     * 
     * @param {typeof data.get_chat_ids_from_zvei} dbfun 
     * @param {typeof telegram_bot.queue_message} msgfun 
     */
    constructor(dbfun, msgfun) {
        super({ format: winston.format.combine(pbTelegramFormat) });
        this.dbfun = dbfun;
        this.sendTelegramMsg = msgfun;
    }

    /**
     * 
     * @param {any} info 
     * @param {() => void} callback 
     */
    async log(info, callback = () => { }) {

        setImmediate(() => {
            this.emit('logged', info);
        });

        const zvei = levelToZVEI[info[LEVEL]]

        const chat_ids = await this.dbfun(zvei);

        for (const index in chat_ids) {
            let id = chat_ids[index];
            if (id != null && id != 0) {
                this.sendTelegramMsg(id, info[MESSAGE], 2 * 24 * 60 * 60 * 1000);
            }
        }
        callback();
    }
}