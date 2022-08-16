import * as validator from './validation.mjs'
export class ZVEIID {
    /**
     * 
     * @param {number|string} zvei_id 
     */
    constructor(zvei_id) {

        const validated_id = validator.is_valid_zvei_id(zvei_id)
        if (!validated_id.isPresent()) {
            throw new Error(`"Can't create ZVEIID: ${zvei_id}" is not a number or not from the range [0,99999]`)
        }
        this.id = validated_id.get();
    }
}

export class ZVEI {

    /**
     * 
     * @param {ZVEIID} zvei_id 
     * @param {string} description 
     * @param {number} test_day 
     * @param {string} test_time_start 
     * @param {string} test_time_end 
     */
    constructor(zvei_id, description, test_day, test_time_start, test_time_end) {
        this.id = zvei_id;
        if (!validator.is_text_safe(description)) {
            throw new Error(`Description "${description}" contains invalid characters`);
        }
        this.description = description;

        if(test_day < 0 || test_day >= 7) {
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
        this.test_time_end = test_time_end;
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
        
        // TODO this returns a string and we compare it against another string. why/how does this work?
        const time = date.toLocaleTimeString("de-DE", {timeZone : timezone}) 

        const right_day = day === this.test_day;
        const in_time_range = this.test_time_start <= time && time <= this.test_time_end;

          return right_day && in_time_range;
    }
}
/**
 * Convenience function for creating a ZVEI.
 * 
 * This function accepts as the id of the zvei either a string or a number. This string/number
 * is then used to create an instance of a {@see ZVEIID} that is then used to create
 * the actual {@see ZVEI} instance
 * 
 * @param {string|number} zvei_id 
 * @param {string} description 
 * @param {number} test_day 
 * @param {string} test_time_start 
 * @param {string} test_time_end 
 * @returns 
 */
export function mk_zvei(zvei_id, description, test_day, test_time_start, test_time_end) {
    return new ZVEI(
        new ZVEIID(zvei_id), description, test_day, test_time_start, test_time_end
    )



}