import { describe, expect, test, beforeAll, beforeEach, afterAll, jest } from '@jest/globals'
import { TestConfig } from './testConfig.js';
import Optional from 'optional-js'

import * as DB from '../src/db.mjs'
import { mk_zvei, ZVEIID } from '../src/model/zvei.mjs';


import * as Z from '../src/model/zvei.mjs'
import { Group } from '../src/model/group.mjs';

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
        if (
            areObjects && !deepEqual(val1, val2) ||
            !areObjects && val1 !== val2
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
    db = await DB.create_database(config.alert_time_zone, config.timeouts.history, db_location);
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
    /**
     * @type {Group}
     */
    let g1;
    /**
     * @type {Group}
     */
    let g2;

    beforeAll(async () => {

        // totally overengineered 
        // TODO probably do not provide default values -> rethink this

        //MEMO: await something.then() does not make sense - you are only awaiting the definition of the then callback
        //Typcially either use .then() OR await

        let group = await db.add_group("Test Group 1");
        if(group.isPresent()){
            g1 = group.get();
        }else{
            console.log(`Could not add "Test Group 1"`);
        }

        let group2 = await db.add_group("Test Group 2");
        if(group2.isPresent()){
            g2 = group2.get();
        }else{
            console.log(`Could not add "Test Group 2"`);
        }
    });

    afterAll(async () => {
        await db?.remove_group(g1);
        await db?.remove_group(g2);
    });

    test("The initial groups are present in the DB", async () => {

        const grps = [g1, g2];
        const groups = await db?.get_groups();
        await grps?.forEach(g => {
            const found = groups?.reduce((acc, curr) => {return acc || deepEqual(g, curr); }, false);
            expect(found).toBeTruthy()
        });
    });

    test("Retrieving individual initial groups should work", async () => {
        const grps = [g1, g2];
        await grps.forEach(async g => {
            const res = await db?.get_group(g.id);
            expect(res?.isPresent()).toBeTruthy()
            expect(deepEqual(res?.get(), g)).toBeTruthy();
        });

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

    //TODO: Clean this up. I think it is difficult to comprehend, expecially for a test case. Also it messes with types.
    /**
     * 
     * @param  {...any} a 
     * @returns {any}
     */
    function cartesian(...a){
        return a.reduce((prev, curr) => {
            prev.flatMap((/** @type {any} */ d) => curr.map((/** @type {any} */ e) => [d, e].flat()))
        });
    }

    // we add a valid ID so that the short circuiting logic has to evalute the invalid group description as well
    const invalid_ids_descs = cartesian(invalid_group_ids.concat([1]), invalid_group_descriptions);
    test.each(invalid_ids_descs)("Trying to update a group's description with either an invalid ID or description fails", async (id, desc) => {
        await expect(db.update_group_description(id, desc)).resolves.toBeFalsy();
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
    test.each(invalid_chat_ids)("Authenticating a group with an invalid auth token '%s' fails", async (chat_id) => {
        const dummy_auth_token = "1234567890"; // magic number with no inherent meaning
        const res = await db.authenticate_group(chat_id, dummy_auth_token);
        expect(res.isPresent()).toBeFalsy()
    });

    test("Authenticating a group with non-existing auth token fails", async () => {
        const unused_auth_token = "1234567890"; // let's pray that is not taken!
        const dummy_chat_id = 5;
        const res = await db.authenticate_group(dummy_chat_id, unused_auth_token);
        expect(res.isPresent()).toBeFalsy();
    });

    test.only("Can not authenticate chat id twice", async () => {
        // TODO do not use a default group here but instead add a new one to prevent issues with other tests
        const dummy_chat_id = 5;

        let auth_token = g1?.auth_token ?? "";
        const authenticated_group_opt = await db.authenticate_group(dummy_chat_id, auth_token);
        console.log(authenticated_group_opt)
        
        expect(authenticated_group_opt.isPresent()).toBeTruthy();
        const authed_group = authenticated_group_opt.get();
        
        console.log(g1);
        console.log(authed_group)

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
        [8, ""]
    ]

    test.each(descs)("The description of some hard-coded ZVEIs should match %i -> %s", async (id, desc) => {

        const res = await db?.get_ZVEI_details(new ZVEIID(id));
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

        const zvei = mk_zvei(zvei_id, zvei_description, test_day, test_time_start, test_time_end);

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

        const zvei = mk_zvei(zvei_id, zvei_description, test_day, test_time_start, test_time_end);

        expect(db?.add_ZVEI(zvei)).resolves.toBeTruthy();

        const returned_zvei = await db?.get_ZVEI(zvei.id);
        expect(returned_zvei?.isPresent()).toBeTruthy();
        expect(returned_zvei?.get()).toEqual(zvei);

        /**
         * @type {Z.ZVEI[]|undefined}
         */
        const all_zveis = await db?.get_ZVEIs();
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
