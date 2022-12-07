'use strict'

import Transport, { TransportStreamOptions } from 'winston-transport';
import TelegramConnector from './telegram.js';


export default class TelegramTransport extends Transport {

    private telegramConnector: TelegramConnector;

    private logTargetChatIds: number[];

    public constructor(options: TransportStreamOptions, logTargets: number[]) {
        super(options);
        this.telegramConnector = TelegramConnector.getInstance();
        this.logTargetChatIds = logTargets;
    }

    public async log(info : any, callback = () => { }) : Promise<void> {

        setImmediate(() => {
            this.emit('logged', info);
        });

        this.logTargetChatIds.forEach(async chatId => {
            //Do not bother about return value
            await this.telegramConnector.sendText(chatId, info.MESSAGE);
        });
        
        callback();
    }
}