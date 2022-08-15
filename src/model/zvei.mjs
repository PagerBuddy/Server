
export class ZVEIID {
    /**
     * 
     * @param {number|string} zvei_id 
     */
    constructor(zvei_id) {

        if (typeof (zvei_id) == "string") {
            zvei_id = parseInt(zvei_id)
            if (isNaN(zvei_id)) {
                throw new Error(`"Can't create ZVEIID: ${zvei_id}" is not a number`)
            }
        }

        if (zvei_id < 0 || zvei_id > 99999) {
            throw new Error(`ZVEIID ${zvei_id} out of range [0,9999]`)
        }
        this.id = zvei_id;

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
        this.description = description;
        this.test_day = test_day;
        this.test_time_start = test_time_start;
        this.test_time_end = test_time_end;
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