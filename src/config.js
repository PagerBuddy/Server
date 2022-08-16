import yargs from "yargs";
import fs from 'fs';
import logging from './logging.mjs';

const NOCONFIG = 1;
const CONFIG_ERR = 2;
const EXIT_FATAL_CONFIG = 1000; //This is a permanently fatal error and will never be solved by a restart

const logger = logging("Config");

export class Config {

    /**
     * 
     * @param {string[]} cli_options
     * @param {boolean} continue_on_error This should only be used with utmost care!
     */
    constructor(cli_options = [], continue_on_error = false) {
        const cli = yargs(cli_options)
            .option('verbose', {
                alias: 'v',
                type: 'boolean',
                description: 'Run with verbose logging (turning on overrides config file setting)',
                default: false
            })
            .option('pagerbuddy_config', {
                alias: 'pb_c',
                description: 'Manually specify the config file',
                default: './config.json',
            })
            .option('ignore_config_error', {
                description: 'Do not exit if config is incomplete',
                default: false
            })
            .parseSync();

        const config_file = cli.pagerbuddy_config;

        if(cli.verbose){
            this.settings.log_level = "silly";
        }

        this.#load_config(config_file, continue_on_error || cli.ignore_config_error);
    }

    /**
     * 
     * @param {string} file 
     * @param {boolean} continue_on_error This should only be used with utmost care!
     * @returns {void}
     */
    #load_config(file, continue_on_error = false) {
        if (!fs.existsSync(file)) {
            logger.error(`Config file '${file}' does not exist!`);
            this.#conditional_exit(EXIT_FATAL_CONFIG, continue_on_error);
        }

        const config = JSON.parse(fs.readFileSync(file).toString());

        const db_file = config.DATABASE_LOCATION;
        if(!fs.existsSync(db_file)){
            logger.error("No valid database file in config.");
            this.#conditional_exit(EXIT_FATAL_CONFIG, continue_on_error);
        }else{
            this.files.database_location = db_file;
        }

        this.files.backup_location = config.BACKUP_LOCATION;
        this.settings.confidential_mode = config.CONFIDENTIAL_MODE ?? false;

        const bot_token = config.TELEGRAM?.BOT_TOKEN;
        const bot_name = config.TELEGRAM?.BOT_NAME;
        if(!this.#check_empty_string(bot_name) || !this.#check_empty_string(bot_token)){
            logger.error("No valid bot token and or name in config.");
            this.#conditional_exit(EXIT_FATAL_CONFIG, continue_on_error);
        }else{
            this.telegram.bot_name = bot_name;
            this.telegram.bot_token = bot_token;
        }

        const admin_groups = config.TELEGRAM?.ADMIN_GROUPS;
        if(!admin_groups || admin_groups == []){
            logger.warn("No admin groups specified in config. You will not be able to configure pagerbuddy via telegram!");
        }else{
            this.telegram.admin_groups = admin_groups;
        }

        const response_config = config.TELEGRAM?.RESPONSE_OVERVIEW;
        if(response_config){
            this.telegram.response_overview.enabled = response_config.ENABLED ?? false;
            this.telegram.response_overview.enabled_all_chats = response_config.ENABLED_FOR_ALL_CHATS ?? false;
            this.telegram.response_overview.enabled_during_test_alarm = response_config.ENABLED_DURING_TEST_ALARM ?? false;
            this.telegram.response_overview.chat_ids = response_config.CHAT_IDS ?? [];
            this.telegram.response_overview.cooldown_time = response_config.COOLDOWN_MS ?? 900000;
            this.telegram.response_overview.react_timeout = response_config.REACT_TIMEOUT_MS ?? 3000;
            this.telegram.response_overview.pin_messages = response_config.PIN_MESSAGES ?? false;
        }

        const timeout_config = config.TIMEOUTS;
        if(timeout_config){
            this.timeouts.history = timeout_config?.HISTORY_TIMEOUT_MS ?? 120000;
            this.timeouts.health = timeout_config?.HEALTH_TIMEOUT_MS ?? 30000;
            this.timeouts.radio_activity = timeout_config?.RADIO_TIMEOUT_MS ?? 1000*60*60*3;
            this.timeouts.internet = timeout_config?.INTERNET_TIMEOUT_MS ?? 5000;
        }

        const timezone = config.ALERT_TIME_ZONE;
        if(!this.#check_empty_string(timezone) || !this.#check_valid_timezone(timezone)){
            logger.error("No valid timezone string (IANA time zone) was set in config.");
            this.#conditional_exit(EXIT_FATAL_CONFIG, continue_on_error);
        }else{
            this.alert_time_zone = timezone;
        }

        const websocket_port = config.PORT;
        if(websocket_port && websocket_port > 0){
            this.websocket.enabled = true;
            this.websocket.port = websocket_port;
        }

        const katsys = config.KATSYS;
        if(katsys){
            const certificate = katsys.CERTIFICATE;
            const master_token = katsys.MASTER_TOKEN;
            const sub_token = katsys.SUB_TOKEN;
            const decode_channels = katsys.DECODE_CHANNELS;
            if(!fs.existsSync(certificate) || !this.#check_empty_string(master_token) || !this.#check_empty_string(sub_token)){
                logger.warn("Katsys specified in config but no valid certificate and/or tokens were provided.");
                this.katsys.enabled = false;
            }else if(!decode_channels || decode_channels.length == 0){
                logger.warn("KatSys specified in config but no channels were selected for decoding.");
                this.katsys.enabled = false;
            }else{
                this.katsys.enabled = true;
                this.katsys.certificate_location = certificate;
                this.katsys.master_token = master_token;
                this.katsys.sub_token = sub_token;
                this.katsys.decode_channels = decode_channels;
            }
        }

        /**@type {Object.<string, string>} */
        const fcm = config.FCM_CREDENTIALS;
        if(fcm){
            this.messaging.enabled = true;
            for (const property in fcm){
                if(!this.#check_empty_string(fcm[property])){
                    logger.warn("FCM specified in config but credentials contain empty strings.");
                    this.messaging.enabled = false;
                    break;
                }
            }
            this.messaging.fcm_credentials = fcm;
        }

    }

    /**
     * 
     * @param {string} timezone 
     * @returns {boolean} If timezone could be parsed without error.
     */
    #check_valid_timezone(timezone){
        try{
            Intl.DateTimeFormat(undefined, {timeZone: timezone});
            return true;
        }catch(error){
            return false;
        }
    }

    /**
     * 
     * @param {string} text 
     * @returns {boolean}
     */
    #check_empty_string(text){
        return text != undefined && text.length > 0;
    }

    /**
     * 
     * @param {number} reason 
     * @param {boolean} ignore_exit 
     * @returns {void}
     */
    #conditional_exit(reason, ignore_exit = false){
        if(!ignore_exit){
            process.exit(reason);
        }
    }


    files = {
        database_location: "",
        backup_location: ""
    };

    settings = {
        confidential_mode: false,
        log_level: "debug"
    };

    telegram = {
        bot_token: "",
        bot_name: "",
        admin_groups: /**@type {number[]} */ ([]),
        response_overview: {
            enabled: false,
            enabled_all_chats: false,
            enabled_during_test_alarm: false,
            chat_ids: /**@type {number[]} */ ([]),
            cooldown_time: 900000,
            react_timeout: 3000,
            pin_messages: false
        }
    };

    timeouts = {
        history: 120000,
        health: 30000,
        radio_activity: 1000*60*60*3,
        internet: 30000 
    };

    alert_time_zone = "";

    websocket = {
        enabled: false,
        port: 3000
    };

    katsys = {
        enabled: false,
        certificate_location: "",
        master_token: "",
        sub_token: "",
        decode_channels: /**@type {string[]} */ ([])
    };

    messaging = {
        enabled: false,
        fcm_credentials: {}
    };

}