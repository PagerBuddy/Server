/**
 * Class capturing the notion of a user.
 * 
 * This basically means that we store a FCM/APNS token with a corresponding type
 * (which is always set to "ANY")
 */
export class User {
    /**
     * 
     * @param {number} id 
     * @param {string} token 
     * @param {string} token_type 
     */
    constructor(id, token, token_type) {
        this.id = id;
        this.token = token;
        this.token_type = token_type;
    }


    /**
     * Ensures a FCM device token only contains valid characters [0-9a-zA-Z\-\_] and has a varying length.
     * @param {string} token The FCM device token to check.
     * @returns {boolean} Whether input contains only valid characters.
     */
    static is_device_token_safe(token) {

        const re = /^[0-9a-zA-Z\-\_\:]{10,200}$/;
        const res = re.test(token);
        return res;
    }
}