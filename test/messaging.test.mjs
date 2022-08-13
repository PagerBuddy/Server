import {describe, expect, test, beforeAll, afterAll, jest} from '@jest/globals'
import {TestConfig} from './testConfig.js'

import * as messaging from "../src/messaging.mjs"
import * as db from '../src/data.js'

const config = new TestConfig();

let conditionalDescribeName = 'FCM messaging - online';
let conditionalDescribeCB = () => {
    const VALID_DEVICE_TOKEN = "eUoBBWKlTP2UCWW6OjEVt3:APA91bHDxEMUjopaL6sRZnleFsHU7vJvNf0V1MotTOgmqV8aesI6lbv1ZNtF3Pru6veth_rZv6Q4F_E_uka4j7wAZ7ZbROuA13GTZAsHmUAKs3QPtVeei0uBzFjbLdCxvG2yJBo84jds";
    //Keep in mind we can never insure this will be valid indefinately...

    const INVALID_DEVICE_TOKEN = ""; //TODO: Enter an invalid device token

    const TESTER_CHAT_ID = -1000000000;

    beforeAll(async () => {
        messaging.init(null, config.alert_time_zone, config.messaging);
    });

    test('graceful handling of obsolete token', async () => {

        const remove_user_mock = jest.spyOn(db, "remove_user").mockImplementation((input) => {
            if(!(typeof (input) == "number" && !isNaN(input))){
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });

        const user_id = 0;
        const result = await messaging.sendTest(INVALID_DEVICE_TOKEN, TESTER_CHAT_ID, user_id);
        //TODO: Fix this test once we have a real (once valid) invalid token
        //expect(remove_user_mock).toHaveBeenCalledWith(user_id);
        expect(result).toEqual(false);

        remove_user_mock.mockRestore();
    });

    test('no error when sending test alert to valid token', async () => {
        const result = await messaging.sendTest(VALID_DEVICE_TOKEN, TESTER_CHAT_ID, 0);
        expect(result).toBeTruthy();
    });

    test('no error when sending alert', async () => {
      
        const timestamp = Date.now();
        const zvei = 99999;
        const description = "JEST TEST";
      
        const token_chat_array = {
          token: VALID_DEVICE_TOKEN,
          chat_id: TESTER_CHAT_ID.toString(),
          user_id: 0
        }
      
        const result = await messaging.sendAlert([token_chat_array], timestamp, zvei, description, false);
        expect(result).toBeTruthy();
    });

    test('no error when probing user token', async() => {
        const remove_user_mock = jest.spyOn(db, "remove_user").mockImplementation((input) => {
            if(!(typeof (input) == "number" && !isNaN(input))){
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });

        const probe = {user_id: 0, token: INVALID_DEVICE_TOKEN};

        expect(async () => {
            await messaging.heartbeatProbe([probe]);
        }).not.toThrow();

        //expect(remove_user_mock).toHaveBeenCalledWith(user_id);

        remove_user_mock.mockRestore();
    })
};

if(config.tests.skip_messaging){
    describe.skip(conditionalDescribeName, conditionalDescribeCB);
}else{
    describe(conditionalDescribeName, conditionalDescribeCB);
}