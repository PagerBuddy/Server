import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import ZVEI from '../../src/model/zvei.mjs'
import { TestConfig } from '../testConfig.js';



describe("ZVEI ID Validation", () => {

    const valid_ids = [100, 0, 99999, 452, "523", "156"]
    const invalid_ids = [-1, "NaN", NaN, "wrong!", 200048202]

    test.each(invalid_ids)("Invalid ID %s should be detected", (id) => {
        expect(ZVEI.validate_zvei_id(id).isPresent()).toBeFalsy()
    });

    test.each(valid_ids)("Valid ID %s should pass", (id) => {
        const validated_id = ZVEI.validate_zvei_id(id);
        expect(validated_id.isPresent()).toBeTruthy()
        expect(validated_id.get()).toBe(parseInt(id.toString()));
    });
});





describe("ZVEI creation", () => {

    const valid_zvei_data = [
        {
            id: 200,
            desc: "JEST TeST ZVEI",
            day: 4,
            start: "01:00",
            end: "01:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: 3,
            start: "02:00",
            end: "03:02"
        }
    ];

    const invalid_zvei_data = [
        {
            id: "99999999",
            desc: "JEST TeST ZVEI",
            day: 4,
            start: "01:00",
            end: "01:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN!",
            day: 3,
            start: "02:00",
            end: "03:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: -1,
            start: "02:00",
            end: "03:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: 20,
            start: "02:00",
            end: "03:02"
        },
        {
            id: /**@type {any} */ (null),
            desc: "JEST TeST ZVEI agaiN",
            day: 3,
            start: "02:00",
            end: "03:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: 3,
            start: "03:00",
            end: "02:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: 3,
            start: "four fifty",
            end: "03:02"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: 3,
            start: "02:00",
            end: "ten sixty"
        },
        {
            id: 201,
            desc: "JEST TeST ZVEI agaiN",
            day: 3,
            start: "02:99",
            end: "03:02"
        }
    ];

    test.each(valid_zvei_data)("For valid ZVEI data '%s', the objects should be created", (z) => {
        expect(() => { new ZVEI(z.id, z.desc, z.day, z.start, z.end) }).not.toThrow()
    });

    test.each(invalid_zvei_data)("For invalid ZVEI data '%s', the objects should not be created", (z) => {
        expect(() => { new ZVEI(z.id, z.desc, z.day, z.start, z.end) }).toThrow()
    });

});

describe("Checking ZVEI Test Times", () => {
    const timezone = new TestConfig().alert_time_zone;
    const zvei = new ZVEI(200,
        "Just a ZVEI",
        4,  // Thursday
        "01:00",
        "01:05");


    //Unix epoch beginns on a thursday at 0:00
    const valid_test_times = [0, 1, 2, 3, 4].map(n => {
        return 0 + n * (1000 * 60)
    })

    test.each(valid_test_times)("Checking the test time '%p' for ZVEIs", (t) => {
        //console.log(new Date(t), timezone)
        expect(zvei.is_test_time(t, timezone)).toBeTruthy();
    });

    test("Test time check in the last minute fails", () => {
        // This is a known bug: https://github.com/PagerBuddy/Server/issues/30
        // this test is only here to be informed when the issue is fixed.
        expect(zvei.is_test_time(0 + 5 * (1000 * 60), timezone)).toBeFalsy()
    })


});