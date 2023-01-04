import { Duration } from "luxon";
import { resolve } from "path";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import { FirebaseCredentials } from "../connectors/firebase.js";
import Log, { TelegramLogTarget } from "../log.js";
import {readFileSync} from "fs";
import { PostgresConnectionCredentialsOptions } from "typeorm/driver/postgres/PostgresConnectionCredentialsOptions.js";

export const CONFIG_FILE_LOCATION = resolve("config.json");

/**
 * Accessor for global setting parameters. These apply system-wide and will only be set by a super administrator.
 * Often changing these values will require a server restart to take effect.
 */
@Entity()
export default class SystemConfiguration extends BaseEntity{

    private static instance : SystemConfiguration;

    //We cannot use log here as we will create circular dependencies!

    @PrimaryGeneratedColumn()
    private id!: number;

    @Column()
    private sysTelegramBotToken?: string;

    public static get telegramBotToken() : string{
        return SystemConfiguration.getInstance().sysTelegramBotToken ?? "";
    }

    @Column()
    private sysTelegramBotEnable: boolean = false;

    public static get telegramBotEnabled() : boolean{
        const instance = SystemConfiguration.getInstance();
        return instance.sysTelegramBotEnable && SystemConfiguration.telegramBotToken != "";
    }

    @Column()
    private sysWebsocketPort?: number;

    public static get websocketPort() : number{
        return SystemConfiguration.getInstance().sysWebsocketPort ?? 0;
    }

    @Column()
    private sysWebsocketEnable: boolean = false;

    public static get websocketEnabled() : boolean{
        const instance = SystemConfiguration.getInstance();
        return instance.sysWebsocketEnable && SystemConfiguration.websocketPort != 0;
    }

    @Column()
    private sysLogLevel?: string;

    public static get logLevel() : string{
        return SystemConfiguration.getInstance().sysLogLevel ?? "debug";
    }

    @Column("simple-json", {array: true})
    private sysTelegramLogTargetIds : TelegramLogTarget[] = [];

    public static get telegramLogTargetIds() : TelegramLogTarget[]{
        return SystemConfiguration.getInstance().sysTelegramLogTargetIds;
    }

    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return Duration.fromMillis(value);
            },
            to(value : Duration) {
                return value.toMillis();
            },
        }
    })
    private sysDoubleAlertTimeout : Duration = Duration.fromObject({minutes: 5});

    public static get doubleAlertTimeout() : Duration{
        return SystemConfiguration.getInstance().sysDoubleAlertTimeout;
    }

    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return Duration.fromMillis(value);
            },
            to(value : Duration) {
                return value.toMillis();
            },
        }
    })
    private sysHealthCheckInterval: Duration = Duration.fromObject({seconds: 10});

    public static get healthCheckInterval() : Duration{
        return SystemConfiguration.getInstance().sysHealthCheckInterval;
    }

    private readConfig() : PagerBuddyConfig{
        let config : PagerBuddyConfig;
        try{
            const rawConfig = readFileSync(CONFIG_FILE_LOCATION, {encoding: "utf-8"});
            config = JSON.parse(rawConfig);
        }catch(error: any){
            console.error("Could not parse config. This is fatal.");
            throw error;
        }
        return config;
    }

    public static get databaseConnection() : PostgresConnectionCredentialsOptions {
        const config = SystemConfiguration.getInstance().readConfig();
        if(!config.DATABASE_CONNECTION){
            throw new Error("Database connection not specified in config file. This is fatal.");
        }
        return config.DATABASE_CONNECTION;
    }

    public static get firebaseCredentials() : FirebaseCredentials {
        const config = SystemConfiguration.getInstance().readConfig();
        if(!config.FIREBASE_CREDENTIAL_LOCATION){
            throw new Error("Location of firebase credentials not specified in config file. This is fatal");
        }
        let credentials : FirebaseCredentials;
        try{
            const rawCreds = readFileSync(resolve(config.FIREBASE_CREDENTIAL_LOCATION), {encoding: "utf-8"});
            credentials = JSON.parse(rawCreds);
        }catch(error: any){
            console.error("Could not parse firebase credentials. This is fatal.");
            throw error;
        }
        return credentials;
    }

    public constructor(){
        super();
    }

    public static getInstance() : SystemConfiguration{
        if(!SystemConfiguration.instance){
            SystemConfiguration.instance = new SystemConfiguration();
        }
        return SystemConfiguration.instance;
    }
}

export type PagerBuddyConfig = {
    DATABASE_CONNECTION?: PostgresConnectionCredentialsOptions,
    FIREBASE_CREDENTIAL_LOCATION?: string
}