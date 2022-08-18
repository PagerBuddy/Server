import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import { TestConfig } from './testConfig.js';
import Optional from 'optional-js'

import * as DB from '../src/db.mjs'
import { mk_zvei, ZVEIID } from '../src/model/zvei.mjs';


import * as Z from '../src/model/zvei.mjs'

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
 * @type {DB.database?}
 */
let db = null
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