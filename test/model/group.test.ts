import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import Group from '../../src/model/group'
import { TestHelper } from '../testhelper'

describe("Some Text", () => {

    beforeAll(async () => {
        await TestHelper.instance.setupTestDB();
    });
    
    afterAll(() => {
        TestHelper.instance.teardownTestDB();
    });
    test("Create a Group object: %s", () => {
        let g1 = Group.create({})
        //let g2 = new Group()
        expect(false).toBeFalsy()
    });
});

