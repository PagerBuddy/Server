import { Duration } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import { FirebaseCredentials } from "../connectors/firebase";
import { TelegramLogTarget } from "../log";

/**
 * Accessor for global setting parameters. These apply system-wide and will only be set by a super administrator.
 * Often changing these values will require a server restart to take effect.
 */
@Entity()
export default class SystemConfiguration extends BaseEntity{

    private static instance : SystemConfiguration;

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

    @Column()
    private sysTelegramLogTargetIds : TelegramLogTarget[] = [];

    public static get telegramLogTargetIds() : TelegramLogTarget[]{
        return SystemConfiguration.getInstance().sysTelegramLogTargetIds;
    }

    @Column()
    private sysDoubleAlertTimeout : Duration = Duration.fromObject({minutes: 5});

    public static get doubleAlertTimeout() : Duration{
        return SystemConfiguration.getInstance().sysDoubleAlertTimeout;
    }

    @Column()
    private sysFirebaseCredentials? : FirebaseCredentials;

    public static get firebaseCredentials() : FirebaseCredentials{
        const std = {
            type: "",
            project_id: "",
            private_key_id: "",
            private_key: "",
            client_email: "",
            client_id: "",
            auth_uri: "",
            token_uri: "",
            auth_provider_x509_cert_url: "",
            client_x509_cert_url: ""
        }
        return SystemConfiguration.getInstance().sysFirebaseCredentials ?? std;
    }

    @Column()
    private sysFirebaseEnable: boolean = false;

    public static get firebaseEnabled() : boolean{
        const instance = SystemConfiguration.getInstance();
        return instance.sysFirebaseEnable && SystemConfiguration.firebaseCredentials.private_key != "";
    }

    @Column()
    private sysHealthCheckInterval: number = 10;

    public static get healthCheckInterval() : number{
        return SystemConfiguration.getInstance().sysHealthCheckInterval;
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