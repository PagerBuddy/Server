import { DataSource } from "typeorm";
import Log from "./log.js";
import Alert from "./model/alert.js";
import Group from "./model/group.js";
import AlertResponse from "./model/response/alert_response.js";
import ResponseConfiguration from "./model/response/response_configuration.js";
import ResponseOption from "./model/response/response_option.js";
import UserResponse from "./model/response/user_response.js";
import SilentConfiguration, { SilentAlways, SilentDayOfMonth, SilentDayOfWeek, SilentNever, SilentTime } from "./model/silent_configuration.js";
import AlertSink from "./model/sinks/alert_sink.js";
import AppSink from "./model/sinks/app_sink.js";
import GroupSink from "./model/sinks/group_sink.js";
import TelegramSink from "./model/sinks/telegram_sink.js";
import UserSink from "./model/sinks/user_sink.js";
import WebhookSink from "./model/sinks/webhook_sink.js";
import AlertSource from "./model/sources/alert_source.js";
import AlertSourceHardwareInterface from "./model/sources/alert_source_hardware_interface.js";
import AlertSourceKatSys from "./model/sources/alert_source_katsys.js";
import AlertSourceManual from "./model/sources/alert_source_manual.js";
import SystemConfiguration from "./model/system_configuration.js";
import Unit, { UnitSubscription } from "./model/unit.js";
import User from "./model/user.js";
import config from "../config.json";

export default class Database{

    private static log = Log.getLogger(Database.name);

    //TODO: Fill with sensible values
    //Currently using ElephantSQL (free) for development
    private static appDataSource = new DataSource({
        type: "postgres",
        url: config.DATABASE_URL,
        synchronize: true,
        entities: [
            AlertResponse, ResponseConfiguration, ResponseOption, UserResponse, 
            AlertSink, AppSink, GroupSink, TelegramSink, UserSink, WebhookSink,
            AlertSource, AlertSourceHardwareInterface, AlertSourceKatSys, AlertSourceManual,
            Alert,
            Group,
            SilentConfiguration, SilentAlways, SilentDayOfMonth, SilentDayOfWeek, SilentNever, SilentTime,
            SystemConfiguration,
            Unit, UnitSubscription,
            User
        ]
    });

    public static async connect() : Promise<void>{
        try{
            await Database.appDataSource.initialize()
        }catch(error: any){
            Database.log.error("Error initialising database. This is fatal.");
            if(error instanceof Error){
                throw error;
            }
        }
    }

    public static async disconnect() : Promise<void>{
        if(Database.appDataSource.isInitialized){
            await Database.appDataSource.destroy();
        }
    }
}