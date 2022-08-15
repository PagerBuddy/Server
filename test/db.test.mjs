import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import { TestConfig } from './testConfig.js';

import DB from '../src/db.mjs'
import { ZVEIID } from '../src/model/zvei.mjs';

const config = new TestConfig();
const db_location = config.files.database_location;


describe('Connecting to a non-existing DB', () => {
    //null is invalid for a string - ts is blocking that for me
    jest.setTimeout(10000);
    test.each(["", "/does/not/exist"])("should return false for path '%p'", async (/** @type {string} */db_path) => {
        await expect(async () => DB("", 2, db_path)).rejects.toThrow();
    });
});

describe('Connecting to an existing DB', () => {
    test(`should not throw an exception for path '${db_location}'`, async () => {
        expect(async () => await DB("", 2, db_location)).not.toThrow();
    });
});


describe('ZVEIs', () => {

    const descs = [
        [1, "SYSTEM DEBUG"],
        [2, "SYSTEM INFO"],
        [3, "SYSTEM WARNING"],
        [4, "SYSTEM ERROR"],
        [5, "SYSTEM REPORT"],
        [10, "SYSTEM ALL ALERTS"]
    ]

    test.each(descs)("The description of some hard-coded ZVEIs should match %i -> %s", async (id, desc) => {
        const db = await DB("", 10, db_location);
        await expect(db.get_zvei_details(new ZVEIID(id))).resolves.toEqual(desc)
    });
});