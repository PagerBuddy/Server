import {describe, expect, test, beforeAll, afterAll, jest} from '@jest/globals'
import {TestConfig} from './testConfig.js';

import * as bot from '../src/telegram/bot.mjs';
import * as health from '../src/health.mjs'
jest.mock('../src/health.mjs');
import * as messaging from '../src/messaging.mjs'

import TelegramBot from 'node-telegram-bot-api';
import ZVEI from '../src/model/zvei.mjs';

const config = new TestConfig();

//These can only be run using the actual bot API wit necessary telegram authentication secrets
let conditionalDescribeName = 'bot operation - online';
let conditionalDescribeCB = () =>{
    let TESTER_CHAT_ID = 0;

    beforeAll(async () => {
        TESTER_CHAT_ID = config.tests.telegram_test_group;
    
        //TODO: Caution data mock is not implemented (yet)
        //If admin functions or external inputs should be tested - check if you have to implement a data mock function first!
    
        //Passing null for messaging and db
        // @ts-ignore
        bot.init(null, config.telegram, config.alert_time_zone, health, null);
    
        //Mock health report
        const get_health_report_mock = jest.spyOn(health, "get_health_report").mockImplementation(() => {
            return "MOCK Health Report";
        });
    
        const telegram_status_mock = jest.spyOn(health, "telegram_status").mockImplementation((status) => {
            return `MOCK Report telegram status: ${status}`;
        });
    
        //Mock FCM manual test request
        const sendTest_mock = jest.spyOn(messaging, "sendTest").mockImplementation((token, chat_id, user_id) => {
            console.log("MOCK test FCM to token: " + token + ", chat_id: " + chat_id + ", user_id: " + user_id);
            return Promise.resolve(true);
        });
    
        bot.start_bot();
    });

    test('no error when queing a message send', () =>{
        expect(bot.queue_message(TESTER_CHAT_ID, "jest test queue add", 10000, {})).resolves.not.toThrowError();
    });
    test('no error when sending a message through queue', async () =>{
        const res = await bot.queue_message(TESTER_CHAT_ID, "jest test send", 10000, {}); 
        expect(res.success).toBeTruthy();
    });
    test('no error when sending and editing a message', async () =>{
        const res = await bot.queue_message(TESTER_CHAT_ID, "jest test edit", 10000, {});

        const opts = {
            parse_mode: /**@type {TelegramBot.ParseMode} */ ('HTML'),
            message_id: res.msg_id,
            chat_id: TESTER_CHAT_ID
        };

        const edit_result = await bot.queue_edit("jest edit test success", opts);

        expect(edit_result).toBeTruthy();
    });
    test('no error when sending an alert', async () =>{
        const zvei = new ZVEI(99999, "JEST TEST", 0, "00:00", "00:00");

        const result = await bot.send_alert(TESTER_CHAT_ID, zvei, Date.now(), config.alert_time_zone, true, "alert text");

        expect(result.msg_res.status).toBe("fulfilled");
        expect(result.resp_res.status).toBe("fulfilled");

        // @ts-ignore
        expect(result.msg_res.value?.success).toBeTruthy();
        // @ts-ignore
        expect(result.resp_res.value?.success).toBeTruthy();

    });

    afterAll(async () => {
        bot.stop_bot();
    
        //Clear all mock functions created with "spyOn"
        jest.restoreAllMocks();
    });
};

if(config.tests.skip_telegram){
    describe.skip(conditionalDescribeName, conditionalDescribeCB);
}else{
    describe(conditionalDescribeName, conditionalDescribeCB);
}





