export class Group {
    /**
     * 
     * @param {number} id 
     * @param {string} description 
     * @param {string} chat_id 
     * @param {string} auth_token 
     */
    constructor(id, description, chat_id, auth_token) {
        this.id = id;
        this.description = description;
        this.chat_id = chat_id;
        this.auth_token = auth_token;
    }
}