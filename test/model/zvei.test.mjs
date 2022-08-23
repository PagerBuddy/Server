import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import ZVEI from '../../src/model/zvei.mjs'




describe("ZVEI ID Validation", () => {

    const valid_ids = [100, 0, 99999, 452, "523", "156"]
    const invalid_ids = [-1, "NaN", NaN, "wrong!", 200048202]

    test.each(invalid_ids)("Invalid ID %s should be detected", (id) => {
        expect(ZVEI.validate_zvei_id(id).isPresent()).toBeFalsy()
    });

    test.each(valid_ids)("Valid ID %s should pass", (id) => {
        const validated_id = ZVEI.validate_zvei_id(id);
        expect(validated_id.isPresent()).toBeTruthy()
        expect(validated_id.get()).toBe(parseInt(id));
    });
});
