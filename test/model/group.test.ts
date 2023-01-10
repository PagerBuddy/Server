import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import Group from '../../src/model/group'
import database from '../../src/database.js'

describe("Some Text", () => {

    beforeAll(async () => {
        await database.connect();
    });
    
    afterAll(async () => {
        await database.disconnect();
    });
    test("Create a Group object: %s", () => {
        let g1 = Group.create({})
        //let g2 = new Group()
        expect(false).toBeFalsy()
    });
});

