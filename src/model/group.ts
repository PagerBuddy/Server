import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, JoinTable, ManyToOne, OneToMany, Relation } from "typeorm";
import Alert from "./alert.js";
import AlertResponse from "./response/alert_response.js";
import ResponseConfiguration from "./response/response_configuration.js";
import GroupSink from "./sinks/group_sink.js";
import Unit from "./unit.js";
import User from "./user.js";

@Entity()
export default class Group extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name: string = "";

    @ManyToMany(() => Unit, {eager: true})
    @JoinTable()
    units?: Relation<Unit>[];

    @ManyToMany(() => User, {eager: true})
    @JoinTable()
    leaders?: Relation<User>[];

    @ManyToMany(() => User, {eager: true})
    @JoinTable()
    members?: Relation<User>[];

    @ManyToOne(() => ResponseConfiguration, {eager: true, onDelete: "RESTRICT"})
    responseConfiguration?: Relation<ResponseConfiguration>;

    @OneToMany(() => GroupSink, (groupSink) => groupSink.group, {eager: true})
    alertSinks?: Relation<GroupSink>[];

    @OneToMany(() => Group, (group) => group.parentGroup, {eager: true})
    subGroups?: Relation<Group>[];

    @ManyToOne(() => Group, (group) => group.subGroups, {onDelete: "CASCADE"})
    private parentGroup?: Relation<Group>;

    public equals(group: Group): boolean{
        return group.id == this.id;
    }

    private isRelevantAlert(alert: Alert): boolean {
        return this.units ? this.units.some((unit) => unit.isMatchingAlert(alert)) : false;
    }

    public handleAlert(alert: Alert) {
        if (this.isRelevantAlert(alert)) {

            const response = AlertResponse.create({
                alert: alert,
                group: this,
                responses: []
            });
            response.linkAlertCallback();

            this.alertSinks?.forEach(sink => {
                sink.sendAlert(response);
            });

            this.members?.forEach(member => {
                member.handleAlert(response);
            })
        }
    }


}