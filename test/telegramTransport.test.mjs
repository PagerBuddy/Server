import {describe, expect, test, beforeAll, afterAll, jest} from '@jest/globals'
import ZVEI from '../src/model/zvei.mjs';

import TelegramTransport from '../src/telegramTransport.mjs';

describe("telegram transport", () => {
    test("log event handled correctly", async () => {
        const SAMPLE_ID = 1;
        const mock_msgfun = jest.fn(async (chat_id, message, timeout, opts) => {
            return {success: true, resend: false, msg_id: 0};
        });
        const mock_dbfun = jest.fn(async (zvei) => {
            return [SAMPLE_ID];
        });

        const transport = new TelegramTransport(mock_dbfun, mock_msgfun);

        const LEVEL_ERR = 4;
        const ZVEI_ERR = new ZVEI(LEVEL_ERR);
        const SAMPLE_TEXT = "This is a log entry.";
        const MESSAGE = Symbol.for('message');
        const LEVEL = Symbol.for('level');


        let SAMPLE_LOG = {
            [MESSAGE]: SAMPLE_TEXT,
            [LEVEL]: "error"
        };
        const TIMEOUT = 2 * 24 * 60 * 60 * 1000;
        const mock_cb = jest.fn(() => {});

        await transport.log(SAMPLE_LOG, mock_cb);

        expect(mock_dbfun).toHaveBeenCalledWith(ZVEI_ERR);
        expect(mock_msgfun).toHaveBeenCalledWith(SAMPLE_ID, SAMPLE_TEXT, TIMEOUT);
        expect(mock_cb).toHaveBeenCalled();
    });

});