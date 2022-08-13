"use strict";
import * as os from 'os';
import * as fs from 'fs';
import { exec } from "child_process";
import * as path from 'path';

const service_file = "./scripts/pagerbuddy.service";
const service_location = "/etc/systemd/system/pagerbuddy.service"

/**
 * Ensures we are running on linux - as service not implemented on other platforms yet.
 * @returns: True if platform is linux.
 */
function check_platform() {

    const is_linux = os.platform() == "linux";

    let is_deactivated = false;
    if (process.env.NO_SERVICE) {
        is_deactivated = true;
    }

    return is_linux && !is_deactivated;
}

/**
 * Copy pagerbuddy.service to systemd directory and enable service.
 */
export function install_service() {


    if (!check_platform()) {
        console.log("PagerBuddy as a service is currently only available on Linux. Cannot install service on this platform.");
        return;
    }

    exec("sudo systemctl stop pagerbuddy");

    let servicedata = fs.readFileSync(service_file, "utf-8");
    let outdata = servicedata.replace(/%pagerbuddy%/g, path.resolve("./"));
    fs.writeFileSync(service_location, outdata, "utf-8");

    exec("sudo systemctl enable pagerbuddy");

    console.log("Installed and enabled pagerbuddy service. Service will start automaticall on boot. Call 'npm startservice' to start now.")
}

/**
 * Stop, disable and remove pagerbuddy service.
 */
export function uninstall_service() {


    if (!check_platform()) {
        return;
    }

    exec("sudo systemctl disable pagerbuddy");
    exec("sudo systemctl stop pagerbuddy");

    try {
        fs.unlinkSync(service_location);
    } catch (err) {
        console.log(err);
    }
}


/**
 * Start the pagerbuddy service.
 */
export function start() {


    if (!check_platform()) {
        console.error("PagerBuddy as a service is not supported on this platform. Cannot start service.");
        return;
    }

    exec("sudo systemctl start pagerbuddy");
}
