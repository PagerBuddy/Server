import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, JoinTable, ManyToOne, OneToMany } from "typeorm";
import Alert from "./alert";
import AlertResponse from "./response/alert_response";
import ResponseConfiguration from "./response/response_configuration";
import GroupSink from "./sinks/group_sink";
import Unit from "./unit";
import User from "./user";

export default class Group extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name: string;

    @Column()
    @ManyToMany(() => Unit, {eager: true})
    @JoinTable()
    units: Unit[];

    @Column()
    @ManyToMany(() => User, {eager: true})
    @JoinTable()
    leaders: User[];

    @Column()
    @ManyToMany(() => User, {eager: true})
    @JoinTable()
    members: User[];

    @Column()
    @ManyToOne(() => ResponseConfiguration, {eager: true, onDelete: "RESTRICT"})
    responseConfiguration: ResponseConfiguration;

    @Column()
    @OneToMany(() => GroupSink, (groupSink) => groupSink.group, {eager: true})
    alertSinks: GroupSink[];

    @Column()
    @OneToMany(() => Group, (group) => group.parentGroup, {eager: true})
    subGroups: Group[];

    @Column()
    @ManyToOne(() => Group, (group) => group.subGroups, {eager: true, onDelete: "CASCADE"})
    parentGroup!: Group;

    constructor(); //This seems to be needed as an (optional) constructor signature for TypeORM
    constructor(
        name: string = "",
        alertSinks: GroupSink[] = [],
        units: Unit[] = [],
        leaders: User[] = [],
        members: User[] = [],
        responseConfiguration: ResponseConfiguration = ResponseConfiguration.default,
        subGroups: Group[] = []) {
        super();
        this.name = name;
        this.alertSinks = alertSinks;
        this.units = units;
        this.leaders = leaders;
        this.members = members;
        this.responseConfiguration = responseConfiguration;
        this.subGroups = subGroups;
    }

    public equals(group: Group): boolean{
        return group.id == this.id;
    }

    public static get default(){
        return new Group();
    }

    private isRelevantAlert(alert: Alert): boolean {
        return this.units.some((unit) => unit.isMatchingAlert(alert));
    }

    public handleAlert(alert: Alert) {
        if (this.isRelevantAlert(alert)) {

            const response = new AlertResponse(alert, this);

            this.alertSinks.forEach(sink => {
                sink.sendAlert(response);
            });

            this.members.forEach(member => {
                member.handleAlert(response);
            })
        }
    }


}