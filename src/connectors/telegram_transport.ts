'use strict'

import Transport, { TransportStreamOptions } from 'winston-transport';
import TelegramConnector from './telegram.js';


export default class TelegramTransport extends Transport {

    private telegramConnector?: TelegramConnector;

    private logTargetChatId: number;

    public constructor(options: TransportStreamOptions, logTarget: number) {
        super(options);
        this.telegramConnector = TelegramConnector.getInstance();
        this.logTargetChatId = logTarget;
    }

    public async log(info : any, callback = () => { }) : Promise<void> {

        setImmediate(() => {
            this.emit('logged', info);
        });

        await this.telegramConnector?.sendText(this.logTargetChatId, info.MESSAGE);
        
        callback();
    }
}