import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertResponse from "../response/alert_response";
import { UnitSubscription } from "../unit";
import UserSink from "./user_sink";

@Entity()
export default class WebhookSink extends UserSink{

    @Column()
    url: string;

    constructor(active: boolean = true, subscriptions: UnitSubscription[] = [], url: string){
        super(active, subscriptions);
        this.url = url;
    }

    async sendAlert(alert: AlertResponse): Promise<void> {
        if(super.isRelevantAlert(alert.alert)){
            //TODO: trigger webhook

        }
    }


}