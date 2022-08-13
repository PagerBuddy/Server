import { describe, expect, test } from '@jest/globals'

import { Schleife } from '../src/katsys.mjs';

const channels = ['456', 'RD_ER']
const multi_schleifen = '456 25123 12:13\nRD_ER 5123 12:13\nRD_FOOO 1234 23:59\n123 54728 14:15';

const interesting = ['456 25123 12:13', 'RD_ER 5123 12:13',]
const boring = ['RD_FOOO 1234 23:59', '123 54728 14:15']
const valid_schleifen = interesting.concat(boring);
const invalid_times = ['456 25123 12.13', '456 25123 12']
const missing_time = ['456 25123 ', '456 25123']
const short_zvei = '456 251 12:13'
const long_vzei = '456 25124343 12:13'


describe("Creating Schleifen", () => {
    test.each(valid_schleifen)('Creating from valid data should not throw an exception: %s', (s) => {
        expect(() => { return new Schleife(s) }).not.toThrow();
    });

    test("Creating with multiple valid schleifen deltas in the constructor's parameter should throw an exception", () => {

        expect(() => { new Schleife(multi_schleifen) }).toThrow();

    });

    test("Creating with null should throw an exception", () => {

        expect(() => { new Schleife(/**@type {string} */ (/**@type {unknown} */ (null))) }).toThrow();
        expect(() => { new Schleife("") }).toThrow();

    });


    test.each(invalid_times)('Creating with invalid times should throw an exception: %s', (s) => {
        expect(() => { new Schleife(s) }).toThrow();
    });

    test.each(invalid_times)('Creating with missing times should throw an exception: %s', (s) => {
        expect(() => { new Schleife(s) }).toThrow();
    });

    test.each([short_zvei, long_vzei])("Invalid ZVEIs: %s", zvei => {
        expect(() => { new Schleife(zvei) }).toThrow()
    })

});

describe("Filtering Schleifen", () => {
    test.each(interesting)("Given interesting Scheifen", (s) => {
        const schleife = new Schleife(s);
        expect(schleife.of_interest(channels)).toBeTruthy();
    });

    test.each(boring)("Given boring Scheifen", (s) => {
        const schleife = new Schleife(s);
        expect(schleife.of_interest(channels)).not.toBeTruthy();
    });
});

