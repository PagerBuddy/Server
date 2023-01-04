import FirebaseConnector from "./connectors/firebase.js";
import TelegramConnector from "./connectors/telegram.js";
import WebAPI from "./connectors/webAPI.js";
import Database from "./database.js";
import HealthMonitor from "./health_monitor.js";
import Log from "./log.js";
import AlertSourceHardwareInterface from "./model/sources/alert_source_hardware_interface.js";
import AlertSourceKatSys from "./model/sources/alert_source_katsys.js";
import AlertSourceManual from "./model/sources/alert_source_manual.js";
import SystemConfiguration from "./model/system_configuration.js";

const log = Log.getLogger("App");

export async function start() {
    //Connect to data

    await Database.connect();

    //Start up sources
    const sources = [];
    sources.push(...await AlertSourceHardwareInterface.find());
    sources.push(...await AlertSourceKatSys.find());
    sources.push(...await AlertSourceManual.find());

    sources.forEach(async source => {
        await source.start();
    });

    //Initialise active output connectors as a test
    if (!FirebaseConnector.getInstance()) {
        log.error("Firebase connector could not be started. This is typically fatal.");
    }
    if (SystemConfiguration.telegramBotEnabled && !TelegramConnector.getInstance()) {
        log.error("Telegram bot activated but connector could not be started.");
    }
    if(!WebAPI.getInstance()){
        log.error("Could not start web API. This will be fatal for any UI interaction.");
    }

    //Start health monitoring
    const healthMonitor = await HealthMonitor.getInstance();
    healthMonitor.startMonitoring(SystemConfiguration.healthCheckInterval);

    //Report we are done
    log.info("PagerBuddy-Server was started.");
}

export async function stop() {
    log.info("Stopping PagerBuddy-Server.");

    //Shut down sources
    const sources = [];
    sources.push(...await AlertSourceHardwareInterface.find());
    sources.push(...await AlertSourceKatSys.find());
    sources.push(...await AlertSourceManual.find());

    sources.forEach(source => {
        source.stop();
    });

    //Stop health monitoring
    const healthMonitor = await HealthMonitor.getInstance();
    healthMonitor.stopMonitoring();

    //Stop active connectors
    await TelegramConnector.getInstance()?.stop();
    WebAPI.getInstance().stop();

    //Unload database
    await Database.disconnect();
}

if (process.argv.length == 3) {
    const what = process.argv[2];
    switch (what) {
        case "stop":
            stop();
            break;
        case "start":
            start();
            break;
        default:
    }
}