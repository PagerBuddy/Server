import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, JoinColumn } from "typeorm";
import alert from "../alert";
import { Group } from "../group.mjs";
import AlertResponse from "../response/alert_response";
import UserResponse from "../response/user_response";
import { UnitSubscription } from "../unit";
import AlertSink from "./alert_sink";

@ChildEntity()
export default abstract class GroupSink extends AlertSink{

    @Column()
    @ManyToOne(() => Group)
    public group!: Group; 

    public constructor(active: boolean = false, subscriptions: UnitSubscription[] = []){
        super(active, subscriptions);
    }

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: alert): boolean {
        return super.isRelevantAlert(alert);
    }
}