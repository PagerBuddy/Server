import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AccessToken from "../access_token";
import AlertResponse from "../response/alert_response";
import { UnitSubscription } from "../unit";
import UserSink from "./user_sink";

@Entity()
export default class AppSink extends UserSink{

    @Column()
    deviceToken: string;

    @Column()
    alertSound: string;

    @Column()
    alertVolume: number;

    @Column()
    token: AccessToken;

    constructor(active: boolean = true, subscriptions: UnitSubscription[] = [], deviceToken: string, alertSound: string, alertVolume: number, token: AccessToken){
        super(active, subscriptions);
        this.deviceToken = deviceToken;
        this.alertSound = alertSound;
        this.alertVolume = alertVolume;
        this.token = token;
    }

    async sendAlert(alert: AlertResponse): Promise<void> {
        if(super.isRelevantAlert(alert.alert)){
            //TODO: Output alert to FCM

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