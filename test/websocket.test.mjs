import {describe, expect, test, beforeAll, afterAll, jest} from '@jest/globals'
import {TestConfig} from './testConfig.js';

import * as websocket from '../src/websocket.mjs';
import * as health from '../src/health.mjs';

import { Server } from "socket.io";
jest.mock("socket.io");

const mock_health = /**@type {health} */ (jest.createMockFromModule('../src/health.mjs'));
mock_health.report_health = jest.fn((data) => {});
mock_health.get_time_offset = jest.fn((siteID) => {return 0});
mock_health.radio_activity = jest.fn((data) => {});

const sample_health = {siteId: "", type: "", device: "", status: "", group: "", csq: "", timestamp: Date.now()};
const sample_zvei = {siteId: "", type: "", zvei: "12345", timestamp: Date.now()};
const sample_aprt = {siteId: "", type: "", subZvei: "", subDec: "", subHex: "", emergencyReason: "", emergencyCity: "", emergencySite: "", from: "", to: "", timestamp: Date.now()};
const sample_status = {siteId: "", type: "", status: "", sender: "", timestamp: Date.now()};

describe("Websocket", () => {

    /**@type {function(typeof sample_health):void} */
    let health_emitter;
    /**@type {function(typeof sample_zvei):void} */
    let zvei_emitter;
    /**@type {function(typeof sample_aprt):void} */
    let aprt_emitter;
    /**@type {function(typeof sample_status): void} */
    let status_emitter;
    /**@type {function} */
    let disconnect_emitter;

    beforeAll(() => {
        const mock_callback = {
            on: jest.fn((type, cb) => {
                switch(type){
                    case "health":
                        health_emitter = cb;
                        break;
                    case "zvei":
                        zvei_emitter = cb;
                        break;
                    case "aprt":
                        aprt_emitter = cb;
                        break;
                    case "status":
                        status_emitter = cb;
                        break;
                    case "disconnect":
                        disconnect_emitter = cb;
                        break;
                }

            })
        };

        // @ts-ignore
        Server.mockImplementation((server) => {
            return {
                on: (/**@type {string} */ event, /**@type {function} */ cb) =>{
                    if(event == "connection"){
                        cb(mock_callback);
                    }
                },
                close: () => {}
            }
        });
    
        const config = {
            enabled: true,
            port: 0
        }
        websocket.init(config, mock_health);
    });

    test("inactive websocket lifecycle does not produce error", async () => {
        const res = await websocket.start_listening(() => {});
        expect(res).toBeTruthy();

        websocket.stop_listening();
    });

    test("health event is reported", async () =>{
        await websocket.start_listening(() => {});

        health_emitter(sample_health);
        expect(mock_health.report_health).toHaveBeenCalledWith(sample_health);

        websocket.stop_listening();
    });

    test("zvei event is handled correctly", async () => {
        const callback_mock = jest.fn((zvei, timestamp, information_content, message) => {});
        await websocket.start_listening(callback_mock);
        
        zvei_emitter(sample_zvei);
        expect(callback_mock).toHaveBeenCalledWith(parseInt(sample_zvei.zvei), sample_zvei.timestamp, 1, "");

        websocket.stop_listening();
    });

    test("aprt event is handled correctly", async () => {
        const callback_mock = jest.fn((zvei, timestamp, information_content, message) => {});
        await websocket.start_listening(callback_mock);
        
        aprt_emitter(sample_aprt);

        const ref_msg = '<b>' + sample_aprt.emergencyReason + '</b>\n' + sample_aprt.emergencyCity;
        expect(callback_mock).toHaveBeenCalledWith(parseInt(sample_aprt.subZvei), sample_aprt.timestamp, 2, ref_msg);

        websocket.stop_listening();
    });

    test("status event does not cause error", async () => {
        await websocket.start_listening(() => {});

        expect(() => {status_emitter(sample_status)}).not.toThrow();

        websocket.stop_listening();
    });

    test("disconnect event does not cause error", async () => {
        await websocket.start_listening(() => {});

        expect(() => {disconnect_emitter()}).not.toThrow();

        websocket.stop_listening();
    });


});