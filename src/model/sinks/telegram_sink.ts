import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertResponse from "../response/alert_response";
import { UnitSubscription } from "../unit";
import GroupSink from "./group_sink";

@Entity()
export default class TelegramSink extends GroupSink{

    @Column()
    chatId: number;

    @Column()
    enableForSilentAlert: boolean;

    constructor(active: boolean = true, subscriptions: UnitSubscription[] = [], chatId: number, enableForSilentAlert: true){
        super(active, subscriptions);
        this.chatId = chatId;
        this.enableForSilentAlert = enableForSilentAlert;
    }

    sendAlert(alert: AlertResponse): void{
        if(super.isRelevantAlert(alert.alert)){
            //TODO: send alert to Telegram

            //These fields will be interesting
            alert.group.responseConfiguration;
            alert.responses;
            alert.alert.isSilentAlert;
            alert.alert.keyword;
            alert.alert.message;
            alert.alert.timestamp;
            alert.alert.location;

            alert.registerUpdateCallback((update: AlertResponse) => {
                //TODO: Handle updates
            });
        }
        
    }
}