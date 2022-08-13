import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import {TestConfig} from './testConfig.js';

import * as data from '../src/data';

const config = new TestConfig();

beforeAll(async () => {
    data.init(config.alert_time_zone, config.timeouts.history, config.files.database_location);
    await data.connect_database();

    await clean_leftover_fail();
});

describe('data requests', () => {
    test('group lifecycle functions correctly', async () => {

        const group_name = "JEST TEST GROUPS";
        const chat_id = 100;
        const auth_token = await data.add_group(group_name);
        const group_id = await data.authenticate_group(chat_id, auth_token);
        expect(group_id).toBeGreaterThanOrEqual(0);

        //Repeat auth should fail
        const group_id2 = await data.authenticate_group(chat_id, auth_token);
        expect(group_id2).toBe(-1);

        const group_name2 = "JEST EDIT TEST";
        const res = await data.update_group(group_id, group_name2);
        expect(res).toBeTruthy();

        const chat_id2 = 101;
        const res2 = await data.replace_chat_id(chat_id, chat_id2);
        expect(res2).toBeTruthy();

        const group_array = await data.get_group_details(group_id);
        expect(group_array[0].description).toBe(group_name2);

        const group_id_res = await data.get_group_id_from_chat_id(chat_id2);
        expect(group_id_res).toBe(group_id);

        const groups_array = await data.get_groups();
        let group_found = false;
        groups_array.forEach(group => {
            if (group.group_id == group_id) {
                group_found = true;
                return;
            }
        });
        expect(group_found).toBeTruthy();

        const res3 = await data.remove_group(group_id);
        expect(res3).toBeTruthy();
    });
    test('zvei lifecycle functions correctly', async () => {
        const zvei_id = 200;
        const zvei_description = "JEST TEST ZVEI";
        const test_day = 4; //thursday - same as zero of unix epoch
        const test_time_start = "01:00";
        const test_time_end = "01:02";

        const res1 = await data.add_zvei(zvei_id, zvei_description, test_day, test_time_start, test_time_end);
        expect(res1).toBeTruthy();

        const zvei_array = await data.get_zvei();
        let zvei_found = false;
        zvei_array.forEach(zvei => {
            if (zvei.zvei_id == zvei_id) {
                zvei_found = true;
            }
        });
        expect(zvei_found).toBeTruthy();

        const description_res = await data.get_zvei_details(zvei_id);
        expect(description_res).toBe(zvei_description);

        //Unix epoch beginns on a thursday at 0:00
        const res2 = await data.is_test_time(zvei_id, 0 + 1000 * 60);
        expect(res2).toBeTruthy();

        const res3 = await data.is_test_time(zvei_id, 0 + 1000 * 60 * 10);
        expect(res3).toBeFalsy();

        const res4 = data.remove_zvei(zvei_id);
        expect(res4).toBeTruthy();
    });
    test('group and zvei linking lifecycle functions correctly', async () => {
        //SETUP group and zvei
        const chat_id = 300;
        const auth_token = await data.add_group("JEST TEST LINKING");
        const group_id = await data.authenticate_group(chat_id, auth_token);
        expect(group_id).toBeGreaterThanOrEqual(0);

        const zvei_id = 301;
        const res1 = await data.add_zvei(zvei_id, "JEST TEST LINKING", 0, "00:00", "00:01");
        expect(res1).toBeTruthy();

        //Start actual tests
        const res2 = await data.add_alarm(zvei_id, group_id);
        expect(res2).toBeTruthy();

        const chat_array = await data.get_chat_ids_from_zvei(zvei_id);
        expect(chat_array).toContain(chat_id);

        const zvei_array = await data.get_zvei_ids_for_group(group_id);
        expect(zvei_array).toContain(zvei_id);

        const alarm_array = await data.get_group_alarms(group_id);
        let zvei_found = false;
        alarm_array.forEach(alarm => {
            if (alarm.zvei_id == zvei_id) {
                zvei_found = true;
                return;
            }
        });
        expect(zvei_found).toBeTruthy();

        const res3 = data.remove_alarm(zvei_id, group_id);
        expect(res3).toBeTruthy();

        //Clean up
        data.remove_zvei(zvei_id);
        data.remove_group(group_id);
    });

    test('user lifecycle functions correctly', async () => {
        //Prepare
        const chat_id = 400;
        const auth_token = await data.add_group("JEST TEST USER");
        const group_id = await data.authenticate_group(chat_id, auth_token);
        expect(group_id).toBeGreaterThanOrEqual(0);

        const zvei_id = 402;
        await data.add_zvei(zvei_id, "JEST TEST USER", 0, "00:00", "00:01");
        await data.add_alarm(zvei_id, group_id);

        //Start Testing
        const user_id = 401;
        const token = "123456789ABC";

        //create user
        const res1 = await data.update_user(user_id, token);
        expect(res1).toBeTruthy();

        //change user
        const token2 = "ABCDEFGHIJKLMNOPQRST";
        const res2 = await data.update_user(user_id, token2);
        expect(res2).toBeTruthy();

        const res3 = await data.add_user_group(user_id, group_id);
        expect(res3).toBeTruthy();

        const chat_list = await data.user_chat_ids(user_id);
        expect(chat_list).toContain(chat_id);

        const token_res = await data.user_token(user_id);
        expect(token_res).toBe(token2);

        const device_list = await data.get_device_ids_from_zvei(zvei_id);
        let token_found = false;
        device_list.forEach(device => {
            if (device.token == token2) {
                token_found = true;
                return;
            }
        });
        expect(token_found).toBeTruthy();

        const check_list = await data.get_check_users_list();
        let full_match = false;
        check_list.forEach(item => {
            if (item.user_id == user_id && item.group_id == group_id && parseInt(item.chat_id) == chat_id) {
                full_match = true;
                return;
            }
        });
        expect(full_match).toBeTruthy();

        const res4 = await data.remove_user_link(user_id, group_id);
        expect(res4).toBeTruthy();

        const res5 = await data.remove_user(user_id);
        expect(res5).toBeTruthy();

        //Clean up
        data.remove_alarm(zvei_id, group_id);
        data.remove_zvei(zvei_id);
        data.remove_group(group_id);
    });
    test('alert history lifecycle functions correctly', async () => {

        const zvei_id = 500;
        const information_content = 1;

        //backdate alert so that we do not have to wait 2min for it to expire
        const alert_timestamp = Date.now() - config.timeouts.history + 3000;
        const res = await data.add_alarm_history(zvei_id, alert_timestamp, information_content);
        expect(res).toBeTruthy();

        const repeat = await data.is_repeat_alarm(zvei_id);
        expect(repeat).toBeTruthy();

        const update = await data.is_alarm_information_update(zvei_id, information_content + 1);
        expect(update).toBeTruthy();

        const update2 = await data.is_alarm_information_update(zvei_id, information_content - 1);
        expect(update2).toBeFalsy();

        //ensure we wait untill the alert must be obsolete (2min)
        const wait_time = alert_timestamp + config.timeouts.history + 500 - Date.now();
        if (wait_time > 0) {
            await new Promise(resolve => setTimeout(resolve, wait_time));
        }

        //This will also delete alarm from DB
        const repeat2 = await data.is_repeat_alarm(zvei_id);
        expect(repeat2).toBeFalsy();

    });

});

afterAll(async () => {
    data.close_database();
});

async function clean_leftover_fail() {
    /**
     * Clear necessary data fields that may have not been cleared when a previous test failed.
     */

    const chat_ids = [100, 101, 300, 400]
    for (let chat_id of chat_ids) {
        let group_id = await data.get_group_id_from_chat_id(chat_id);
        if(group_id){
            await data.remove_group(group_id);
        }
        
    }

    const user_ids = [401]
    for (let user_id of user_ids){
        await data.remove_user(user_id);
    }

    const zvei_ids = [200, 301, 402, 500,];
    for (let zvei_id of zvei_ids) {
        await data.remove_zvei(zvei_id);
    }
}


