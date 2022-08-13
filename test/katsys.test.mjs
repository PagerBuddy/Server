import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals'
import fs from 'fs'
import {TestConfig} from './testConfig.js'

import * as health from '../src/health.mjs'
jest.mock('../src/health.mjs');
import * as katsys from '../src/katsys.mjs'
import WebSocket from 'ws';
jest.mock('ws');

const katsys_alert_sample = {
    type: 'data',
    msg: 'Alarmierungsdaten erhalten.',
    statusCode: 'alarm_data',
    statusClass: 'success',
    data: {
        textElements: {
            abschnitt: '',
            abteilung: 'ST 1.OG ABC',
            alarmdatum: '24.12.2022', //DD.MM.YYYY
            alarmuhrzeit: '12:13:14', //HH:MM:SS
            datum_kurz: '', //DD.MM
            einsatzdatum: '', //DD.MM.YYYY
            einsatzmittel_delta: '', //RK Erlangen 22-71-01 HH:MM
            einsatznummer_teil1: 'R 5.2 220000 1234',
            einsatzort: '91000 Wunschort - Wunschort',
            freitext: 'Patient hustet',
            hausnummer: '1',
            hausnummernzusatz: '',
            objekt: 'Krankenhaus Wunschort',
            ort: 'Wunschort',
            ortsteil: '',
            plz: '91000',
            schlagwort: '#R9012#KTP#KTP - Heimfahrt',
            schleifen_delta: '', //456 25123 HH:MM\nRD_ER 5123 HH:MM
            stichwort: 'RD KTP',
            strasse: 'Wunschstrasse',
            "x-koordinate": '4428356.99',
            "y-koordinate": '5496195.74',
            zustandigeils: 'ILS Nürnberg'
        }
    }
};

let timezone = "";
/**@type {function} */
let event_message_callback;

beforeAll(async () => {
    const config = new TestConfig();
    timezone = config.alert_time_zone;

    const katsys_config = {
        enabled: true,
        master_token: "test",
        sub_token: "test",
        certificate_location: "./katsys-cloud.pem",
        decode_channels: ["456", "RD_ER"]
    };

    katsys.init(katsys_config, timezone, health);

    // @ts-ignore
    WebSocket.mockImplementation(() => {
        return {
            on: (/**@type {string} */ eventName, /**@type {function} */ eventCallback) => {
                //console.log("MOCK registered WS callback for: " + eventName);
                if (eventName == "message") {
                    event_message_callback = eventCallback;
                }
            },
        };
    });
});

describe('KatSys', () => {
    test('initial alert package is handled correctly and triggers an alert', async () => {

        const radio_activity_mock = jest.spyOn(health, "radio_activity").mockImplementation((health_data) => {
            console.log("MOCK health activity: " + JSON.stringify(health_data));
        });

        //Replace fs read to allow testing without a certificate file -- only once as jest needs this too
        jest.spyOn(fs, "readFileSync").mockImplementationOnce((path, options) => {
            console.log("MOCK would open certificate file: " + path);
            return "";
        });

        let call_zvei = "";
        let call_timestamp = 0;

        const mock_alert_callback = jest.fn((zvei, timestamp, msg) => {
            console.log("MOCK alert - zvei: " + zvei + ", timestamp: " + timestamp + ", msg: " + msg);
            call_zvei = zvei;
            call_timestamp = timestamp;
        });

        katsys.start(mock_alert_callback);

        const ref_timestamp = Date.now();
        const datetime = new Date(ref_timestamp);
        const timeStringLong = datetime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone });
        const dateStringLong = datetime.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone });
        const timeStringShort = datetime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
        const dateStringShort = datetime.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: timezone });

        katsys_alert_sample.data.textElements.alarmdatum = dateStringLong;
        katsys_alert_sample.data.textElements.alarmuhrzeit = timeStringLong;
        katsys_alert_sample.data.textElements.datum_kurz = dateStringShort;
        katsys_alert_sample.data.textElements.einsatzdatum = dateStringLong;
        katsys_alert_sample.data.textElements.einsatzmittel_delta = "RK Erlangen 22-71-01 " + timeStringShort;
        katsys_alert_sample.data.textElements.schleifen_delta = "456 25123 " + timeStringShort + "\nRD_ER 5123 " + timeStringShort;


        if (event_message_callback) {
            event_message_callback(JSON.stringify(katsys_alert_sample));
        }

        await expect(mock_alert_callback).toHaveBeenCalledTimes(2);
        await expect(call_zvei).toBe(25123);
        await expect(call_timestamp).toBeGreaterThan(ref_timestamp - 1000 * 60);
        await expect(radio_activity_mock).toHaveBeenCalled();
    });





    test('secondary alert package is handled correctly and triggers an alert', async () => {
        const radio_activity_mock = jest.spyOn(health, "radio_activity").mockImplementation((health_data) => {
            console.log("MOCK health activity: " + JSON.stringify(health_data));
        });

        //Replace fs read to allow testing without a certificate file -- only once as jest needs this too
        jest.spyOn(fs, "readFileSync").mockImplementationOnce((path, options) => {
            console.log("MOCK would open certificate file: " + path);
            return "";
        });

        let call_zvei = "";
        let call_timestamp = 0;

        const mock_alert_callback = jest.fn((zvei, timestamp, msg) => {
            console.log("MOCK alert - zvei: " + zvei + ", timestamp: " + timestamp + ", msg: " + msg);
            call_zvei = zvei;
            call_timestamp = timestamp;
        });

        //katsys.start(katsys.old_extract, mock_alert_callback);
        katsys.start(mock_alert_callback)

        const datetime = new Date(Date.now() - 1000 * 60 * 60 * 2); //Simulate original alert 2 hours ago, additional alert now
        const timeStringLong = datetime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone });
        const dateStringLong = datetime.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone });
        const dateStringShort = datetime.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: timezone });

        const ref_timestamp = Date.now();
        const nowtime = new Date(ref_timestamp);
        const timeStringShortNow = nowtime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

        katsys_alert_sample.data.textElements.alarmdatum = dateStringLong;
        katsys_alert_sample.data.textElements.alarmuhrzeit = timeStringLong;
        katsys_alert_sample.data.textElements.datum_kurz = dateStringShort;
        katsys_alert_sample.data.textElements.einsatzdatum = dateStringLong;
        katsys_alert_sample.data.textElements.einsatzmittel_delta = "RK Erlangen 22-71-01 " + timeStringShortNow;
        katsys_alert_sample.data.textElements.schleifen_delta = "456 25123 " + timeStringShortNow + "\nRD_ER 5123 " + timeStringShortNow;

        if (event_message_callback) {
            event_message_callback(JSON.stringify(katsys_alert_sample));
        }

        await expect(mock_alert_callback).toHaveBeenCalledTimes(2);
        await expect(call_zvei).toBe(25123);
        await expect(call_timestamp).toBeGreaterThan(ref_timestamp - 1000 * 60);
        await expect(radio_activity_mock).toHaveBeenCalled();
    });

});

afterAll(() => {
    jest.restoreAllMocks();

});