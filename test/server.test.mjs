import {describe, expect, test, beforeAll, afterAll, jest} from '@jest/globals'
import * as server from '../src/server.js'
import {TestConfig} from './testConfig.js'

import * as messaging from '../src/messaging.mjs';
import * as telegramBot from '../src/telegram/bot.mjs';
import * as websocket from '../src/websocket.mjs';
import * as katsys from '../src/katsys/katsys.mjs';


describe("server operation", () => {
    test("no error during server lifecycle", async () => {
        let spyBot = jest.spyOn(telegramBot, "start_bot").mockImplementation(() => {});
        let spyKatsys = jest.spyOn(katsys, "start").mockImplementation((callback) => {});
        let spyWebsocket = jest.spyOn(websocket, "start_listening").mockImplementation((callback) => {
            return Promise.resolve(true);
        });

        
        const cli_ignore_config_err = "--ignore_config_error=true";
        process.argv.push(cli_ignore_config_err);

        await server.start();

        expect(spyBot).toHaveBeenCalled();
        expect(spyKatsys).toHaveBeenCalled();
        expect(spyWebsocket).toHaveBeenCalled();

        jest.spyOn(telegramBot, "stop_bot").mockImplementation(() => {
            return Promise.resolve();
        });
        await server.stop();

    })

    test("no error when queing incoming alert", async () => {

        let spyMessaging = jest.spyOn(messaging, "sendAlert").mockImplementation(
            /**@type {typeof messaging.sendAlert} */
            (token_chat_array, alert_timestamp, alert_time_zone, zvei) => {
                return Promise.resolve(true);
        });

        //spyBot not necessarily called - only if 99999 or 10 is registered with a chat id
        let spyBot = jest.spyOn(telegramBot, "send_alert").mockImplementation(
            /**@type {typeof telegramBot.send_alert} */
            async (chat_id, zvei, timestamp, alert_time_zone, is_manual, text) => {
                let bot_resp = { success: true, resend: false, msg_id: 0 };
                let [msg_res, resp_res] = await Promise.allSettled([Promise.resolve(bot_resp), Promise.resolve(bot_resp)]);
                return {msg_res, resp_res};
        });

        let spyInitBot = jest.spyOn(telegramBot, "start_bot").mockImplementation(() => {});
        let spyKatsys = jest.spyOn(katsys, "start").mockImplementation((callback) => {});
        let spyWebsocket = jest.spyOn(websocket, "start_listening").mockImplementation((callback) => {
            return Promise.resolve(true);
        });

        const config = new TestConfig();

        const zvei = 99999;
        const timestamp = Date.now() - config.timeouts.history + 5000; //Move timestamp to close before timeout to avoid failing on repeat execution
        const information_content = 1;

        const cli_ignore_config_err = "--ignore_config_error=true";
        process.argv.push(cli_ignore_config_err);

        await server.start();
        
        let result = await server.queue_alarm(zvei, timestamp, information_content)

        expect(spyMessaging).toHaveBeenCalledWith([], timestamp, zvei, "", false);
        expect(result).toBeTruthy();

        let spyBotClose = jest.spyOn(telegramBot, "stop_bot").mockImplementation(() => {
            return Promise.resolve();
        });
        await server.stop();
    });
});

