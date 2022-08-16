import Optional from 'optional-js'

/**
* Checks whether a text contains safe data.
*
*  This check is Is handled rather restrictive  by only allowing the characters (A-Za-z0-9_\s).
* @param {string} text Text to validate.
* @returns {boolean} Whether input is valid text.
*/
export function is_text_safe(text) {
    const re = /^[\wäÄöÖüÜß()\-\s]*$/;
    const res = re.test(text);
    return res;
}

/**
 * Check whether the input is  a valid ZVEI ID.
 * 
 * An ID is valid if it is a number from the range [0,9999]. The method tries to parse strings using `parseInt`.
 * @param {string|number} zvei_id 
 * @returns {Optional<number>} empty optional if the ID was not valid; optional containing the number if it was a valid ID
 */
export function is_valid_zvei_id(zvei_id) {
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
 * Ensures input is a valid telegram chat id (numerical digits, optional -).
 * @param {number} chat_id Chat ID to validate.
 * @returns {boolean} Whether input is a valid chat ID;
 */
 export function is_chat_id_safe(chat_id) {

    let res = chat_id != 0 && is_numeric_safe(chat_id);
    return res;
}

/**
 * Ensures input only contains numeric digits.
 * @param {number} input Number to validate.
 * @returns {boolean} Whether input is a valid number.
 */
export function is_numeric_safe(input) {
    return typeof (input) == "number" && !isNaN(input);
}

/**
 * Ensures input is a valid time in the format HH:mm.
 * @param {string} time Text to validate.
 * @returns {boolean} Whether input is a valid timestamp.
 */
 export function is_time_safe(time) {


    const re = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    const res = re.test(time);
    return res;
}