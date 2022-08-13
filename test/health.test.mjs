import {describe, expect, test, beforeAll, afterAll, jest} from '@jest/globals';
import {TestConfig} from './testConfig.js';

import * as health from '../src/health.mjs';

beforeAll(() => {
    const config = new TestConfig();
    const timezone = config.alert_time_zone;
    health.init(config.timeouts, timezone);

});

describe('health lifecylce', () => {
    test('no error setting health check timer', () => {
        expect(() => health.start_health_monitoring()).not.toThrowError();
        health.stop_health_monitoring();
    });

    test('no error reporting device heartbeat', () => {
        const site1 = "TestSiteA";
        const site2 = "TestSiteB";
        const site3 = "TestSiteC";

        let health_struct = {
            siteId: "",
            type: "health",
            device: "zvei",
            timestamp: Date.now()
        }

        health_struct.siteId = site1;
        health.report_health(health_struct);
        health_struct.siteId = site2
        health.report_health(health_struct);
        health_struct.siteId = site3
        health.report_health(health_struct);

        health_struct.timestamp = Date.now();
        health_struct.siteId = site1
        health.report_health(health_struct);

        const report = health.get_health_report();

        expect(report).toContain(site1);
        expect(report).toContain(site2);
        expect(report).toContain(site3);
    });

    test('no error reporting radio activity', () => {
        const site = "TestSiteD";

        const health_struct = {
            siteId: site,
            type: "health",
            device: "zvei",
            timestamp: Date.now(),
            status: "connected",
            csq: "-0",
            group: ""
        }

        health.report_health(health_struct);

        const alert_struct = {
            siteId: site,
            type: "zvei",
            zvei: "99999",
            timestamp: Date.now()
        };

        expect(() => health.radio_activity(alert_struct)).not.toThrowError();
    });

    test('correct handling of site time offset', () => {
        const site = "TestSiteE";

        let health_struct = {
            siteId: site,
            type: "health",
            device: "zvei",
            timestamp: Date.now() - 59*60*1000,
            status: "connected",
            csq: "-0",
            group: ""
        }
        health.report_health(health_struct);

        const readOffset = health.get_time_offset(site);
        expect(readOffset).toBe(-60*60*1000); //Offset is rounded to an hour by health

        health_struct.timestamp = Date.now() + 59*60*1000; //suddenly shifting TZ by two hours
        expect(() => health.report_health(health_struct)).not.toThrowError();

        health_struct.timestamp = Date.now() - 59*60*1000; // Back to normal
        expect(() => health.report_health(health_struct)).not.toThrowError();
    });
})