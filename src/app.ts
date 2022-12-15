import FirebaseConnector from "./connectors/firebase";
import TelegramConnector from "./connectors/telegram";
import Database from "./database";
import HealthMonitor from "./health_monitor";
import Log from "./log";
import AlertSourceHardwareInterface from "./model/sources/alert_source_hardware_interface";
import AlertSourceKatSys from "./model/sources/alert_source_katsys";
import AlertSourceManual from "./model/sources/alert_source_manual";
import SystemConfiguration from "./model/system_configuration";


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
    if (SystemConfiguration.firebaseEnabled && !FirebaseConnector.getInstance()) {
        log.error("Firebase activated but connector could not be started.");
    }
    if (SystemConfiguration.telegramBotEnabled && !TelegramConnector.getInstance()) {
        log.error("Telegram bot activated but connector could not be started.");
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

    //Unload database
    await Database.disconnect();
}