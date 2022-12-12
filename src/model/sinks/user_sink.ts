import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import alert from "../alert";
import AlertResponse from "../response/alert_response";
import UserResponse from "../response/user_response";
import { UnitSubscription } from "../unit";
import AlertSink from "./alert_sink";

@ChildEntity()
export default abstract class UserSink extends AlertSink{

    constructor(active: boolean = false, subscriptions: UnitSubscription[] = []){
        super(active, subscriptions);
    }

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: alert): boolean {
        return super.isRelevantAlert(alert);
    }
}