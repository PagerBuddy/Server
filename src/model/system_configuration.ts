import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
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
    private sysWebsocketPort?: number;

    public static get websocketPort() : number{
        return SystemConfiguration.getInstance().sysWebsocketPort ?? 0;
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

    public static getInstance() : SystemConfiguration{
        if(!SystemConfiguration.instance){
            SystemConfiguration.instance = new SystemConfiguration();
        }
        return SystemConfiguration.instance;
    }
}