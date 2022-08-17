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