export default class Schleife {

    //lets make these private by default
    #group;
    zvei;
    #alert_time;

    /**
     * @param {string} schleife_desc The textual description of the Schleife
     */
    constructor(schleife_desc) {
        if (!schleife_desc) {
            throw new Error('No parameter provided')
        }
        if (schleife_desc.split(" ").length > 3) {
            throw new Error(`Too many parameters for Schleife provided: ${schleife_desc}`)
        }
        const [group, zvei, alert_time] = schleife_desc.split(" ");
        if (zvei.length < 4 || zvei.length > 5) {
            throw new Error(`Invalid ZVEI: ${zvei}`);
        }
        if (zvei.length == 4) {
            this.zvei = parseInt(`2${zvei}`);
        }
        else {
            this.zvei = parseInt(zvei);
        }

        if (alert_time.split(":").length != 2) {
            throw new Error(`Invalid alert time: ${alert_time}`);
        }
        this.#group = group.toString();
        this.#alert_time = alert_time;
    }

    /**
     * @param {string[]} channels_to_consider Array of 
     * @returns {boolean} true Iff the schleife should be notified/alerted
     */
    of_interest(channels_to_consider) {
        return channels_to_consider.includes(this.#group);
    }

    /**
     * @param {number} timestamp_ms 
     * @param {string} alert_time_zone
     * @returns {number}
     */
    alert_timestamp(timestamp_ms, alert_time_zone) {
        //KatSys pings do not have a timestamp, we have to make one in KatSys time ourselfs

        let outTime = timestamp_ms;
        //We have to manually check if time is accurate, as it may be a changed alert with wrong time
        if (Date.now() - timestamp_ms > 1000 * 60) {
            //Timestamp is older than a minute, check if alternative timestamp fits

            let alt_timeseg = this.#alert_time.split(":"); //get HH and MM
            let alt_timestamp = parseInt(alt_timeseg[0]) * 60 + parseInt(alt_timeseg[1]); //Timestamp from delta in minutes
            const tzTime = new Date(new Date(Date.now()).toLocaleString("en-US", { timeZone: alert_time_zone })); //We assume KatSys is in alert time
            let ref_timestamp = tzTime.getHours() * 60 + tzTime.getMinutes(); //Timestamp now in Katsys time

            if (ref_timestamp - alt_timestamp < 2) {
                //Alternative timestamp is within two minutes of now time - use now time
                outTime = Date.now();
            }
        }
        return outTime;
    }
}