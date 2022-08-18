export class Group {
    /**
     * 
     * @param {number} id 
     * @param {string} description 
     * @param {?string} chat_id 
     * @param {?string} auth_token 
     */
    constructor(id, description, chat_id, auth_token) {
        this.id = id;
        this.description = description;

        const one_is_present = chat_id || auth_token 
        const only_chat_or_auth = one_is_present && !(chat_id  && auth_token)

        if (!only_chat_or_auth) {
            throw new Error("Only either chat id or auth token may contain a value")
        }
        this.chat_id = chat_id;
        this.auth_token = auth_token;
    }

    /**
    * Ensures an authentication token contains only valid characters [0-9A-Za-z] and has a length of 10.
    * @param {string} token The authentication token to check.
    * @returns {boolean} Whether input contains only valid characters.
    */
    static is_auth_token_safe(token) {
        let re = /^[0-9A-Za-z]{10}$/;
        let res = re.test(token);
        return res;
    }
}