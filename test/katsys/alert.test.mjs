import { describe, expect, test } from '@jest/globals'
import { KatSysAlert, katsys_alert, init } from '../../src/katsys/katsys.mjs';
import {TestConfig} from '../testConfig.js';
import * as health from '../../src/health.mjs'

const config = new TestConfig();
const timezone = config.alert_time_zone;

const katsys_config = {
    enabled: true,
    master_token: "test",
    sub_token: "test",
    certificate_location: "./katsys-cloud.pem",
    decode_channels: ["456", "RD_ER"]
};

init(katsys_config, timezone, health);


const valid_data = [
    {
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
        schleifen_delta: '456 25123 12:13\nRD_ER 5123 12:13\nRD_FOOO 1234 23:59\n123 54728 14:15', //456 25123 HH:MM\nRD_ER 5123 HH:MM
        stichwort: 'RD KTP',
        strasse: 'Wunschstrasse',
        "x-koordinate": '4428356.99',
        "y-koordinate": '5496195.74',
        zustandigeils: 'ILS Nürnberg'
    },
    {
        abschnitt: '',
        abteilung: 'ST 1.OG ABC',
        alarmdatum: '13.3.2022', //DD.MM.YYYY
        alarmuhrzeit: '08:15:14', //HH:MM:SS
        datum_kurz: '', //DD.MM
        einsatzdatum: '', //DD.MM.YYYY
        einsatzmittel_delta: '', //RK Erlangen 22-71-01 HH:MM
        einsatznummer_teil1: 'R 5.2 220000 1234',
        einsatzort: '91000 Wunschort - Wunschort',
        freitext: 'Patient hustet',
        hausnummer: '1',
        hausnummernzusatz: '',
        objekt: 'Arztpraxis Wunscharzt',
        ort: 'Wunschort',
        ortsteil: '',
        plz: '91000',
        schlagwort: '#R9012#KTP#KTP - Heimfahrt',
        schleifen_delta: '123 54728 14:15', //456 25123 HH:MM\nRD_ER 5123 HH:MM
        stichwort: 'RD KTP',
        strasse: 'Wunschstrasse',
        "x-koordinate": '4428356.99',
        "y-koordinate": '5496195.74',
        zustandigeils: 'ILS Nürnberg'
    },
];

const valid_with_counts = [[valid_data[0], 4, 2], [valid_data[1], 1, 0]];

/**
 * 
 * @param {string[][]} vals 
 * @returns {katsys_alert}
 */
function mk_data(vals) {
    let template = {
        abschnitt: '',
        abteilung: 'ST 1.OG ABC',
        datum_kurz: '', //DD.MM
        einsatzdatum: '', //DD.MM.YYYY
        einsatzmittel_delta: '', //RK Erlangen 22-71-01 HH:MM
        einsatznummer_teil1: 'R 5.2 220000 1234',
        einsatzort: '91000 Wunschort - Wunschort',
        freitext: 'Patient hustet',
        hausnummer: '1',
        hausnummernzusatz: '',
        objekt: 'Arztpraxis Wunscharzt',
        ort: 'Wunschort',
        ortsteil: '',
        plz: '91000',
        schlagwort: '#R9012#KTP#KTP - Heimfahrt',
        stichwort: 'RD KTP',
        strasse: 'Wunschstrasse',
        "x-koordinate": '4428356.99',
        "y-koordinate": '5496195.74',
        zustandigeils: 'ILS Nürnberg',
        alarmdatum: '13.3.2022', //DD.MM.YYYY
        alarmuhrzeit: '08:15:14', //HH:MM:SS
        schleifen_delta: '123 54728 14:15', //456 25123 HH:MM\nRD_ER 5123 HH:MM
    };

    vals.forEach(([k, v]) => {
        const key = /**@type {keyof template} */ (k);
        template[key] = v
    })


    return template;
}

/**
 * 
 * @param {string[][][]} valss 
 * @returns {katsys_alert[]}
 */
function mk_data_lists(valss) {
    return valss.map(v => {
        return mk_data(v);
    });
}

/**
 * 
 * @param {string} entry 
 * @param {string[]} vals 
 * @returns {katsys_alert[]}
 */
function make_cases(entry, vals) {
    let valss = vals.map(v => { return [[entry, v]] });
    return mk_data_lists(valss);
}

const invalid_delta = make_cases('schleifen_delta', ['', 'geht nicht', '456 25123'])
const invalid_date = make_cases('alarmdatum', ['', '15.01:1992', '13.5.3.2.4.', 'völiger Quark'])
const invalid_time = make_cases('alarmuhrzeit', ['', 'geht nicht', '12.30', '12:30'])

describe("Creating KatSysAlert objects", () => {
    let helper = (/**@type {katsys_alert} */ obj) => {
        expect(() => {
            new KatSysAlert(
                obj.alarmdatum,
                obj.alarmuhrzeit,
                obj.einsatzort,
                obj.schlagwort,
                obj.schleifen_delta,
                timezone,
                katsys_config.decode_channels)
        }).not.toThrow();
        expect(() => { KatSysAlert.alert_from_json(obj, timezone, katsys_config.decode_channels) }).not.toThrow();
    }

    test.each(invalid_date)("Invalid date: '%s'", helper);
    test.each(invalid_time)("Invalid time: '%s'", helper);
    test.each(invalid_delta)("Invalid schleifen delta: '%s'", helper);
});

describe("Investigating Schleifen", () => {
    test.each(valid_data)("Schleifen of interest area always less or equal than all schleifen", /** @type {katsys_alert} */d => {
        const alert = KatSysAlert.alert_from_json(d,timezone, katsys_config.decode_channels);
        expect(alert.schleifen.length).toBeGreaterThanOrEqual(alert.schleifen_of_interest.length)
    });
    test.each(valid_with_counts)("Have the correct amount of data", (data, n_schleifen, n_interesting_schleifen) => {
        // @ts-ignore
        const alert = KatSysAlert.alert_from_json(data,timezone, katsys_config.decode_channels);
        expect(alert.schleifen.length).toBe(n_schleifen);
        expect(alert.schleifen_of_interest.length).toBe(n_interesting_schleifen);
    });
});
