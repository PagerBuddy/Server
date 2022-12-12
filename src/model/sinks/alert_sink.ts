import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, ManyToMany, JoinTable } from "typeorm";
import Alert from "../alert";
import AlertResponse from "../response/alert_response";
import UserResponse from "../response/user_response";
import { UnitSubscription } from "../unit";

@Entity()
export default abstract class AlertSink extends BaseEntity{
    
    @PrimaryGeneratedColumn()
    id!: string;

    @Column()
    active: boolean;

    @Column()
    @ManyToMany(() => UnitSubscription)
    @JoinTable()
    subscriptions: UnitSubscription[];

    constructor(active: boolean = false, subscriptions: UnitSubscription[] = []){
        super();
        this.active = active;
        this.subscriptions = subscriptions;
    }

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: Alert) : boolean{
        return this.active && this.subscriptions.some((sub) => sub.isMatchingAlert(alert));
    }
}