import * as validator from './validation.mjs'
import Optional from 'optional-js'

export default class ZVEI {

    /**
     * 
     * @param {string|number} zvei_id 
     * @param {string} description 
     * @param {number} test_day 
     * @param {string} test_time_start 
     * @param {string} test_time_end 
     */
    constructor(zvei_id, description, test_day, test_time_start, test_time_end) {
        
        const validated_id = ZVEI.validate_zvei_id(zvei_id)
        if (!validated_id.isPresent()) {
            throw new Error(`"Can't create ZVEIID: ${zvei_id}" is not a number or not from the range [0,99999]`)
        }
        this.id = validated_id.get();
        
        if (!validator.is_text_safe(description)) {
            throw new Error(`Description "${description}" contains invalid characters`);
        }
        this.description = description;

        if (test_day < 0 || test_day >= 7) {
            throw new Error(`Test day '${test_day}' is not from the range [0,6]`);
        }
        this.test_day = test_day;

        if (!validator.is_time_safe(test_time_start)) {
            throw new Error(`Test time start "${test_time_start}" is not a valid time of format HH:MM`)
        }
        this.test_time_start = test_time_start;

        if (!validator.is_time_safe(test_time_end)) {
            throw new Error(`Test time end "${test_time_end}" is not a valid time of format HH:MM`)
        }
        if (test_time_end < test_time_start) {
            throw new Error(`Test time end "${test_time_end}" is not later than test time start "${test_time_start}"`)
        }
        this.test_time_end = test_time_end;
    }

    /**
     * Check whether the input is  a valid ZVEI ID and, if so, returns it as a number
     * 
     * An ID is valid if it is a number from the range [0,9999]. The method tries to parse strings using `parseInt`.
     * 
     * @param {string|number} zvei_id 
     * @returns {Optional<number>} empty optional if the ID was not valid; optional containing the number if it was a valid ID
     */
    static validate_zvei_id(zvei_id) {
        if (typeof (zvei_id) == "string") {
            zvei_id = parseInt(zvei_id)
            if (isNaN(zvei_id)) {
                return Optional.empty();
            }
        }

        if (zvei_id < 0 || zvei_id > 99999) {
            return Optional.empty();
        }

        return Optional.of(zvei_id);
    }

    /**
     * Checks if a given time is in the test alarm window of a ZVEI unit
     * @param {number} time_ 
     * @param {string} timezone 
     * @returns 
     */
    is_test_time(time_, timezone) {

        const date = new Date(time_)
        const day = date.getDay();

        //TODO this returns a string and we compare it against another string. why/how does this work?
        const time = date.toLocaleTimeString("de-DE", { timeZone: timezone })

        const right_day = day === this.test_day;
        const in_time_range = this.test_time_start <= time && time <= this.test_time_end;

        return right_day && in_time_range;
    }
}
