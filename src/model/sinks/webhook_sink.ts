import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertResponse from "../response/alert_response";
import UserResponse from "../response/user_response";
import { UnitSubscription } from "../unit";
import UserSink from "./user_sink";

@ChildEntity()
export default class WebhookSink extends UserSink{

    @Column()
    url: string;

    constructor(active: boolean = false, subscriptions: UnitSubscription[] = [], url: string = ""){
        super(active, subscriptions);
        this.url = url;
    }

    public async sendAlert(alert: AlertResponse): Promise<void> {
        if(super.isRelevantAlert(alert.alert)){
            //TODO: trigger webhook

        }
    }


}