import { describe, expect, test, beforeAll, beforeEach, afterAll, jest } from '@jest/globals'
import { TestConfig } from './testConfig.js';
import Optional from 'optional-js'
import sqlite3 from 'sqlite3';
import * as fs from 'fs';


import * as DB from '../src/db.mjs'
import ZVEI from '../src/model/zvei.mjs';


import * as Z from '../src/model/zvei.mjs'
import { Group } from '../src/model/group.mjs';
import { number } from 'yargs';

const config = new TestConfig();
const db_location = config.files.database_location;

/**
 *  Performs an equality check between two objects. 
 * 
 * This method is only necessary as Javascript misses a function to compare objects directly.
 * The code is taken from {@link https://dmitripavlutin.com/how-to-compare-objects-in-javascript/}
 * See also {@link https://stackoverflow.com/questions/1068834/object-comparison-in-javascript} for a discussion.
 *  @param {any} object1 
 * @param {any} object2 
 * @returns {boolean} True ifff the objects are identical
 */
function deepEqual(object1, object2) {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    for (const key of keys1) {
        const val1 = object1[key];
        const val2 = object2[key];
        const areObjects = isObject(val1) && isObject(val2);
        //Read why we need NaN check: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN
        if (
            areObjects && !deepEqual(val1, val2) ||
            !areObjects && val1 !== val2 && !Number.isNaN(val1)
        ) {
            return false;
        }
    }
    return true;
}

/**
 * 
 * @param {any} object 
 * @returns {boolean} True iff the parameter is not null and an object
 */
function isObject(object) {
    return object != null && typeof (object) === 'object';
}

/**
 * @type {DB.database}
 */
let db;
beforeAll(async () => {
    // an empty string 
    const db_ = new sqlite3.Database(':memory:', (err) => {
        if (err) {
            console.error(err.message);
            console.error("Could not create test database. This is a fatal error!");
        }
    });
    const db_setup = fs.readFileSync("./test/test-database-setup.sql").toString();
    db_.exec(db_setup, function (/**@type {any} */ err) {
        if (err) {
            console.error(err.message);
            fs.unlinkSync(db_location);
            throw Error("An error occured trying to initialize the test database. This is fatal.");
        }
    });
    db = new DB.database("", 2, db_);
})



describe('Connecting to a non-existing DB', () => {
    //null is invalid for a string - ts is blocking that for me
    jest.setTimeout(10000);
    test.each(["", "/does/not/exist"])("should return false for path '%p'", async (/** @type {string} */db_path) => {
        await expect(async () => DB.create_database("", 2, db_path)).rejects.toThrow();
    });
});

describe('Connecting to an existing DB', () => {
    test(`should not throw an exception for path '${db_location}'`, async () => {
        expect(async () => await DB.create_database("", 2, db_location)).not.toThrow();
    });
});


describe('Groups', () => {


    test.each([1, 2])("There should be an initial group in the DB with ID %p", async (id) => {
        const res = await db?.get_group(id);
        expect(res?.isPresent()).toBeTruthy()
    });

    test("Adding and deleting a group should work", async () => {
        const gopt = await db.add_group("description");
        expect(gopt?.isPresent()).toBeTruthy();
        const g = gopt.get();

        await expect(db.remove_group(g)).resolves.toBeTruthy();

        const gopt2 = await db.get_group(g.id);
        expect(gopt2.isPresent()).toBeFalsy()

    })

    /**@type {number[]} */
    const invalid_group_ids = [/**@type {any} */ (null), NaN, "sgfdfhg"];

    test.each(invalid_group_ids)("Trying to access groups using invalid group ID '%s' should fail", async (invalid_id) => {
        const fail = await db.get_group(invalid_id);
        expect(fail.isPresent()).toBeFalsy()
    });

    test.each(invalid_group_ids)("Trying to access group ZVEIs using invalid group ID '%s' should return no ZVEIs", async (invalid_id) => {
        const fail = await db.get_group_zveis(invalid_id);
        expect(fail.length).toBe(0)
    })



    const invalid_group_descriptions = ["*$)H", "we really häte ünicode π"];
    test.each(invalid_group_descriptions)("Adding a group with the invalid description '%s' should fail", async (desc) => {
        const fail = await db.add_group(desc);
        expect(fail.isPresent()).toBeFalsy();
    });

    
    /**
     * Computes the Cartesian product of arbitrary many arrays
     * @param  {...any} as The arrays to compute the Cartesian product of
     * @returns {any} The Cartesian product of the arrays
     */
    function cartesian(...as) {
        as.reduce((prev, curr) => {
            prev.flatMap((/** @type {any} */ d) => curr.map((/** @type {any} */ e) => [d, e].flat()))
        });
        return as;
    }

    // we add a valid ID so that the short circuiting logic has to evalute the invalid group description as well
    const invalid_ids_descs = cartesian(invalid_group_ids.concat([1]), invalid_group_descriptions);
    test.each(invalid_ids_descs)("Trying to update a group's description with either an invalid ID or description fails", async (id, desc) => {
        const res = await db.update_group_description(id, desc);
        expect(res).toBeFalsy();
    });

    test("Changing a group description works as expected", async () => {
        const desc1 = "FOO BAR BAZ";
        const desc2 = "BAR FOO BAZ";
        const gopt = await db.add_group(desc1);
        expect(gopt.isPresent()).toBeTruthy();

        const g = gopt.get();
        expect(g.description).toBe(desc1);

        expect(db.update_group_description(g.id, desc2)).resolves.toBeTruthy();

        const gop2 = await db.get_group(g.id);
        expect(gop2.isPresent()).toBeTruthy();

        const g2 = gop2.get();
        expect(g2.description).toBe(desc2)
        expect(g2.description).not.toBe(desc1)

        await expect(db?.remove_group(g)).resolves.toBeTruthy()
    });



    const invalid_auth_tokens = ["123456789", "123456jnsle", "123456!8907"]
    test.each(invalid_auth_tokens)("Authenticating a group with an invalid auth token '%s' fails", async (auth_token) => {
        const dummy_chat_id = 1; // magic number with no inherent meaning
        const res = await db.authenticate_group(dummy_chat_id, auth_token);
        expect(res.isPresent()).toBeFalsy()
    });

    /**@type {number[]} */
    const invalid_chat_ids = [0, NaN, /**@type {any} */ (null)];
    test.each(invalid_chat_ids)("Authenticating a group with an invalid chat ID '%s' fails", async (chat_id) => {
        const dummy_auth_token = "1234567890"; // magic number with no inherent meaning
        const res = await db.authenticate_group(chat_id, dummy_auth_token);
        expect(res.isPresent()).toBeFalsy()
    });

    test("Authenticating a group with non-existing auth token fails", async () => {
        const unused_auth_token = "AAAAAAAAAA"; // let's pray that is not taken!
        const dummy_chat_id = 5;
        const res = await db.authenticate_group(dummy_chat_id, unused_auth_token);
        expect(res.isPresent()).toBeFalsy();
    });

    test("Can not authenticate chat id twice", async () => {
        // TODO do not use a default group here but instead add a new one to prevent issues with other tests
        const dummy_chat_id = 5;

        const g1 = (await db.get_group(1)).get();

        let auth_token = g1?.auth_token ?? "";
        const authenticated_group_opt = await db.authenticate_group(dummy_chat_id, auth_token);

        expect(authenticated_group_opt.isPresent()).toBeTruthy();
        const authed_group = authenticated_group_opt.get();

        expect(authed_group.auth_token).toBeNull();
        expect(authed_group.chat_id).toBe(dummy_chat_id)

        // try to authenticate again
        const authed_twice = await db.authenticate_group(dummy_chat_id, auth_token);
        expect(authed_twice?.isPresent()).toBeFalsy() // should not work

    });
});

describe('ZVEIs', () => {

    // use valid ZVEI IDs in this test only! If you plan to test for invalid IDs, do so in a separate `zei.test.mjs` file
    const descs = [
        [1, "SYSTEM DEBUG"],
        [2, "SYSTEM INFO"],
        [3, "SYSTEM WARNING"],
        [4, "SYSTEM ERROR"],
        [5, "SYSTEM REPORT"],
        [10, "SYSTEM ALL ALERTS"],
        [12345, "Testing Purposes ZVEI"],
        [8, ""]
    ]

    test.each(descs)("The description of some hard-coded ZVEIs should match %i -> %s", async (id, desc) => {

        const res = await db?.get_ZVEI_details(id);
        if (desc) {
            expect(res?.get()).toEqual(desc)
        }
        else {
            expect(res?.isPresent()).toBeFalsy()
        }
    });

    test("Trying to add a ZVEI twice fails as IDs need to be unique", () => {

        const zvei_id = 200;
        const zvei_description = "JEST TEST ZVEI";
        const test_day = 4; //thursday - same as zero of unix epoch
        const test_time_start = "01:00";
        const test_time_end = "01:02";

        const zvei = new ZVEI(zvei_id, zvei_description, test_day, test_time_start, test_time_end);

        expect(db?.add_ZVEI(zvei)).resolves.toBeTruthy()
        expect(db?.add_ZVEI(zvei)).resolves.toBeFalsy()
        expect(db?.remove_ZVEI(zvei)).resolves.toBeTruthy()
    });

    test('zvei lifecycle functions correctly', async () => {
        // somehow can't re-use the zvei above as even with the --runInBand option
        // there is an issue with trying to add the samse ZVEI twice
        const zvei_id = 201;
        const zvei_description = "JEST ANOTHER TEST ZVEI";
        const test_day = 6;
        const test_time_start = "01:55";
        const test_time_end = "01:59";

        const zvei = new ZVEI(zvei_id, zvei_description, test_day, test_time_start, test_time_end);

        const res = await db?.add_ZVEI(zvei);
        expect(res).toBeTruthy();

        const returned_zvei = await db?.get_ZVEI(zvei.id);
        expect(returned_zvei?.isPresent()).toBeTruthy();
        expect(returned_zvei?.get()).toEqual(zvei);

        /**
         * @type {ZVEI[]}
         */
        const all_zveis = await db.get_ZVEIs();
        let zvei_found = false;
        all_zveis?.forEach(zvei_iter => {
            if (deepEqual(zvei, zvei_iter)) {
                zvei_found = true;
            }
        });
        expect(zvei_found).toBeTruthy();

        const description_res = await db?.get_ZVEI_details(zvei.id);
        expect(description_res?.isPresent()).toBeTruthy();
        expect(description_res?.get()).toBe(zvei_description);

        await db?.remove_ZVEI(zvei);

        const r = await db?.get_ZVEI(zvei.id);

        expect(r?.isPresent()).toBeFalsy();

    });

});


describe("Alarms", () => {
    test('Alarm history lifecycle functions correctly', async () => {
        const zvei_id = 500;
        const information_content = 1;

   
        //backdate alert so that we do not have to wait 2min for it to expire
        const alert_timestamp = Date.now() - config.timeouts.history + 3000;
        const res = await db.add_alarm_history(zvei_id, alert_timestamp, information_content);
        expect(res).toBeTruthy();

        const repeat = await db.is_repeat_alarm(zvei_id);
        expect(repeat).toBeTruthy();

        const update = await db.is_alarm_information_update(zvei_id, information_content + 1);
        expect(update).toBeTruthy();

        const update2 = await db.is_alarm_information_update(zvei_id, information_content - 1);
        expect(update2).toBeFalsy();
        
        //ensure we wait untill the alert must be obsolete (2min)
        const wait_time = alert_timestamp + config.timeouts.history + 500 - Date.now();
        if (wait_time > 0) {
            await new Promise(resolve => setTimeout(resolve, wait_time));
        }

        //This will also delete alarm from DB
        const repeat2 = await db.is_repeat_alarm(zvei_id);
        expect(repeat2).toBeFalsy();

    });
