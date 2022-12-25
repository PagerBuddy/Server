import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, ManyToMany, JoinTable, ChildEntity, Relation, TableInheritance } from "typeorm";
import Alert from "../alert.js";
import AlertResponse from "../response/alert_response.js";
import UserResponse from "../response/user_response.js";
import { UnitSubscription } from "../unit.js";

@Entity()
@TableInheritance({ column: { type: "varchar", name: "type" } })
export default abstract class AlertSink extends BaseEntity{
    
    @PrimaryGeneratedColumn()
    id!: string;

    @Column()
    active: boolean = false;

    @ManyToMany(() => UnitSubscription, {eager: true})
    @JoinTable()
    subscriptions?: Relation<UnitSubscription>[];

    public static get default() : AlertSink{
        return DefaultSink.create({
            subscriptions: []
        });
    }

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: Alert) : boolean{
        const subs = this.subscriptions ?? [];
        return this.active && subs.some((sub) => sub.isMatchingAlert(alert));
    }
}

@ChildEntity()
export class DefaultSink extends AlertSink{

    public async sendAlert(alert: AlertResponse): Promise<void>{
    }
}