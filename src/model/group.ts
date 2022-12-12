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
    @ManyToMany(() => Unit)
    @JoinTable()
    units: Unit[];

    @Column()
    @ManyToMany(() => User)
    @JoinTable()
    leaders: User[];

    @Column()
    @ManyToMany(() => User)
    @JoinTable()
    members: User[];

    @Column()
    @ManyToOne(() => ResponseConfiguration)
    responseConfiguration: ResponseConfiguration;

    @Column()
    alertSinks: GroupSink[];

    @Column()
    @OneToMany(() => Group, (group) => group.parentGroup)
    subGroups: Group[];

    @Column()
    @ManyToOne(() => Group, (group) => group.subGroups)
    parentGroup!: Group;

    constructor(); //This seems to be needed as an (optional) constructor signature for TypeORM
    constructor(
        name?: string,
        alertSinks: GroupSink[] = [],
        units: Unit[] = [],
        leaders: User[] = [],
        members: User[] = [],
        responseConfiguration?: ResponseConfiguration,
        subGroups: Group[] = []) {
        super();
        this.name = name ?? "";
        this.alertSinks = alertSinks;
        this.units = units;
        this.leaders = leaders;
        this.members = members;
        this.responseConfiguration = responseConfiguration ?? new ResponseConfiguration("");
        this.subGroups = subGroups;
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