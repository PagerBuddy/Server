import * as validator from './validation.mjs'
import Optional from 'optional-js'

export default class ZVEI {

    /**
     * 
     * @param {string|number} zvei_id 
     * @param {string} [description = ""]
     * @param {number} [test_day = -1]
     * @param {string} [test_time_start = "00:00"]
     * @param {string} [test_time_end = "00:00"]
     */
    constructor(zvei_id, description = "", test_day = -1, test_time_start = "00:00", test_time_end = "00:00") {
        
        const validated_id = ZVEI.validate_zvei_id(zvei_id)
        if (!validated_id.isPresent()) {
            throw new Error(`"Can't create ZVEIID: ${zvei_id}" is not a number or not from the range [0,99999]`)
        }
        this.id = validated_id.get();
        
        if (!validator.is_text_safe(description)) {
            throw new Error(`Description "${description}" contains invalid characters`);
        }
        this.description = description;

        if (test_day < -1 || test_day >= 7) {
            throw new Error(`Test day '${test_day}' is not from the range [-1,6]`);
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
     * Check whether the input is a valid ZVEI ID and, if so, returns it as a number
     * 
     * An ID is valid if it is a number from the range [0,99999]. The method tries to parse strings using `parseInt`.
     * 
     * @param {string|number} zvei_id 
     * @returns {Optional<number>} empty optional if the ID was not valid; optional containing the number if it was a valid ID
     */
    static validate_zvei_id(zvei_id) {
        if (typeof (zvei_id) === "string") {
            zvei_id = parseInt(zvei_id)
        }

        if (isNaN(zvei_id) ||zvei_id < 0 || zvei_id > 99999) {
            return Optional.empty();
        }

        return Optional.of(zvei_id);
    }

    /**
     * Check whether the input is a valid ZVEI ID
     * 
     * An ID is valid if it is a number from the range [0,9999]. The method tries to parse strings using `parseInt`.
     * 
     * @param {string|number} zvei_id 
     * @returns {boolean} Whether the ID is valid
     */
    static is_valid_id(zvei_id) {
        return ZVEI.validate_zvei_id(zvei_id).isPresent();
    }

    /**
     * Checks if a given time is in the test alarm window of a ZVEI unit
     * @param {number} time_ 
     * @param {string} timezone 
     * @returns {boolean} True if the provided time is within the test alarm window.
     */
    is_test_time(time_, timezone) {

        const date = new Date(time_)
        const day = date.getDay();
        const local_time_str = date.toLocaleTimeString("de-DE", { timeZone: timezone });

        const time = ZVEI.#get_test_time(local_time_str);
        const start = ZVEI.#get_test_time(this.test_time_start);
        const end = ZVEI.#get_test_time(this.test_time_end);

        const right_day = day === this.test_day;
        const in_time_range = start == end || start <= time && time <= end;

        return right_day && in_time_range;
    }

    /**
     * Small helper to safely get the time of day in minutes of a "HH:mm(:ss)" string
     * @param {string} test_time 
     * @returns {number}
     */
    static #get_test_time(test_time){
        const default_value = 0;
        if(test_time.length < 5){
            //wrong format, assume default
            return default_value;
        }

        const hour_string = test_time.substring(0, 2);
        const minute_string = test_time.substring(3, 5);

        return parseInt(hour_string)*60 + parseInt(minute_string);

    }
}
