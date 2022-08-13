import * as  http from 'http';
import { Server } from "socket.io";
import winston from 'winston';

import logging from './logging.mjs';
import * as myhealth from './health.mjs';

/**@type {winston.Logger} */
let logger;

/**@type {boolean} */
let ENABLED = false;

/** @type {Number} */
let PORT;
/** @type {myhealth} */
let health;

/** @type {http.Server} */
let server;
/**@type {Server} */
let io;

/**
 * 
 * @param {{enabled: boolean, port: number}} config 
 * @param {myhealth} health_ 
 */
export function init(config, health_) {
    logger = logging("Websocket");
    ENABLED = config.enabled;
    PORT = config.port;
    health = health_;
}

/**
 * Subscribe to input devices.
 * @param {{ (zvei_id: number, timestamp: number, information_content: number, text?: string): void}} alarm_callback Callback to fire with an alarm item.
 * @returns {Promise<boolean>}
 */
export function start_listening(alarm_callback) {
    if(!ENABLED){
        return Promise.resolve(false);
    }


    /**@type {http.RequestListener} */
    const requestListener = function (req, res) {
        res.writeHead(404);
        res.end();
    };

    server = http.createServer(requestListener);
    io = new Server(server);

    io.on('connection', (socket) => {
        logger.debug('A connection to an alert interface was established.');
        socket.on('health', (/**@type {{siteId: String, type: String, device: String, status: String, group: String, csq: String, timestamp: number}} */ data) => {
            health.report_health(data);
        });
        socket.on('zvei', async (/**@type {{siteId: string, type: string, zvei: string, timestamp: number}} */ data) => {
            logger.debug(`Received ZVEI alert ${data.zvei} from ${data.siteId}`);
            let offset = health.get_time_offset(data.siteId);
            alarm_callback(parseInt(data.zvei), data.timestamp - offset, 1, '');
            health.radio_activity(data);
        });
        socket.on('aprt', async (/**@type {{siteId: string, type: string, subZvei: string, subDec: String, subHex: String, emergencyReason: String, emergencyCity: String, emergencySite: String, from: String, to: String, timestamp: number}} */ data) => {
            logger.debug(`Received APRT alert ${data.subZvei} from ${data.siteId}`);
            let offset = health.get_time_offset(data.siteId);
            let msg = '<b>' + data.emergencyReason + '</b>\n' + data.emergencyCity
            alarm_callback(parseInt(data.subZvei), data.timestamp - offset, 2, msg);
            health.radio_activity(data);
        });
        socket.on('status', (data) => {
            // TODO this should probably be implemented
            //console.log('status'); //Ignore this for now
            //console.log(data);
        });
        socket.on('disconnect', () => {
            logger.debug('An alert interface disconnected.');
        });
    });

    server.on('error', (e) => {
        // @ts-ignore - e.code does exist, contrary to ts beliefs
        if (e.code === 'EADDRINUSE') {
            logger.error(`Address in use ${PORT}. This is fatal for incoming interfaces. Probably a different instance is already active.`);
        }
    });

    return new Promise((resolve) => {
        server.listen(PORT, () => {
            logger.debug(`Listening on port ${PORT} for incoming websocket connections.`);
            resolve(true);
        });
    });
}

export function stop_listening() {
    if (io != null) {
        io.close();
    }

    if (server != null) {
        server.close();
    }
}