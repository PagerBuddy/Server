import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import alert from "../alert";
import AlertResponse from "../response/alert_response";
import { UnitSubscription } from "../unit";
import AlertSink from "./alert_sink";

@Entity()
export default abstract class GroupSink extends AlertSink{

    constructor(active: boolean, subscriptions: UnitSubscription[]){
        super(active, subscriptions);
    }

    abstract sendAlert(alert: AlertResponse): Promise<void>;

    protected isRelevantAlert(alert: alert): boolean {
        return super.isRelevantAlert(alert);
    }
}