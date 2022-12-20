import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import alert from "../alert.js";
import AlertResponse from "../response/alert_response.js";
import UserResponse from "../response/user_response.js";
import { UnitSubscription } from "../unit.js";
import AlertSink from "./alert_sink.js";

@ChildEntity()
export default abstract class UserSink extends AlertSink{

    public constructor(active: boolean = false, subscriptions: UnitSubscription[] = []){
        super(active, subscriptions);
    }

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: alert): boolean {
        return super.isRelevantAlert(alert);
    }
}