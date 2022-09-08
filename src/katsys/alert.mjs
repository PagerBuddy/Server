/**
 * @typedef {Object} katsys_alert
 * @property {string} alarmdatum '01.01.2022'
 * @property {string} alarmuhrzeit '10:10:10'
 * @property {string} einsatzort '91000 Wunschort - Wunschort'
 * @property {string} schlagwort '#R9012#KTP#KTP - Heimfahrt'
 * @property {string} schleifen_delta '123 25123 10:10\nRD_NN 5123 10:10'
 */

import Schleife from './schleife.mjs'


export class KatSysAlert {
    //location;
    //keyword;
    msg;
    timestamp_ms;
    schleifen_of_interest;

    /**@type {Schleife[]} */
    schleifen = []; //This is only exposed because of test - bad practise?

    /**
     * 
     * @param {string} alert_date 
     * @param {string} alert_time 
     * @param {string} location 
     * @param {string} keyword 
     * @param {string} schleifen_delta 
     * @param {string} alert_time_zone
     * @param {Array<string>} decode_channels
     * @param {any} logger
     */
    constructor(alert_date,
        alert_time,
        location,
        keyword,
        schleifen_delta,
        alert_time_zone,
        decode_channels,
        logger = null) {

        this.msg = `<b>${keyword}</b>\n${location}`

        const raw_schleifen = schleifen_delta.split('\n');
        raw_schleifen.forEach((raw_schleife) => {
            try {
                const schleife = new Schleife(raw_schleife);
                this.schleifen.push(schleife);
            } catch (error) {
                logger?.warn("Error generating alert list: " + error);
            }
        });

        const date_parts = alert_date.split(".")
        if (date_parts.length != 3) {
            logger?.warn(`Invalid date: ${alert_date}. Timestamp will probably be nonsensical.`);
        }
        const time_parts = alert_time.split(":")
        if (time_parts.length != 3) {
            logger?.warn(`Invalid time: ${alert_time}. Timestamp will probably be nonsensical.`);
        }
        const timestamp = new Date(
            parseInt(date_parts[2]),
            parseInt(date_parts[1]) - 1,
            parseInt(date_parts[0]),
            parseInt(time_parts[0]),
            parseInt(time_parts[1]),
            parseInt(time_parts[2])
        );

        const refTime = new Date(Date.now()); //Must use now to ensure correct DST
        const tzTime = new Date(refTime.toLocaleString("en-US", { timeZone: alert_time_zone })); //We assume KatSys is in alert time
        const tzOffset = Math.round((tzTime.getTime() - refTime.getTime()) / 1000 / 60) * 1000 * 60;

        this.timestamp_ms = timestamp.getTime() - tzOffset;

        this.schleifen_of_interest = this.schleifen.filter(s => {
            return s.of_interest(decode_channels);
        })
    }

    /**
    * @param {katsys_alert} textElements 
    * @param {string} alert_time_zone
    * @param {Array<string>} decode_channels
    * @param {any} logger
    * @returns {KatSysAlert}
    */
    static alert_from_json(textElements, alert_time_zone, decode_channels, logger = null) {
        return new this(
            textElements.alarmdatum,
            textElements.alarmuhrzeit,
            textElements.einsatzort,
            textElements.schlagwort,
            textElements.schleifen_delta,
            alert_time_zone,
            decode_channels,
            logger
        );
    }
}
