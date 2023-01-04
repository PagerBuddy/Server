/**@module scripts/service */

import * as os from 'os';
import * as fs from 'fs';
import { exec } from "child_process";
import * as path from 'path';

const SERVICE_FILE = "./scripts/pagerbuddy.service";
const SERVICE_LOCATION = "/etc/systemd/system/pagerbuddy.service";

/**
 * Ensures we are running on linux - as service not implemented on other platforms yet.
 * @returns: True if platform is linux.
 */
export function checkPlatform() : boolean {
    return os.platform() == "linux";
}

/**
 * Copy pagerbuddy.service to systemd directory and enable service.
 */
export function install() {

    if (!checkPlatform()) {
        console.log("PagerBuddy as a service is currently only available on Linux. Cannot install service on this platform.");
        return;
    }

    stop();

    let servicedata = fs.readFileSync(SERVICE_FILE, {encoding: "utf-8"});
    let outdata = servicedata.replace(/%pagerbuddy%/g, path.resolve("./"));
    fs.writeFileSync(SERVICE_LOCATION, outdata, "utf-8");

    exec("systemctl enable pagerbuddy");

    console.log("Installed and enabled PagerBuddy service. Service will start automatically on boot. Call 'npm startservice' to start now.")
}

/**
 * Stop, disable and remove pagerbuddy service.
 */
export function uninstall() {
    if (!checkPlatform()) {
        return;
    }

    exec("systemctl disable pagerbuddy");
    exec("systemctl stop pagerbuddy");

    try {
        fs.unlinkSync(SERVICE_LOCATION);
    } catch (err) {
        console.log(err);
    }
}


/**
 * Start the pagerbuddy service.
 */
function start() {
    if (!checkPlatform()) {
        console.error("PagerBuddy as a service is not supported on this platform. Cannot start service.");
        return;
    }
    exec("systemctl start pagerbuddy");
}

/**
 * Stop the pagerbuddy service.
 */
function stop() : void{
    if (!checkPlatform()) {
        return;
    }
    exec("systemctl stop pagerbuddy");
}

if (process.argv.length == 3) {
    const what = process.argv[2];
    switch (what) {
        case "install":
            install();
            break;
        case "stop":
            stop();
            break;
        case "start":
            start();
            break;
        case "uninstall":
            uninstall();
            break;
        default:
    }
}
