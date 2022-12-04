import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import Alert from "./alert";
import AlertResponse from "./response/alert_response";
import ResponseConfiguration from "./response/response_configuration";
import GroupSink from "./sinks/group_sink";
import Unit from "./unit";
import User from "./user";

export default class Group extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name: string;

    @Column()
    units: Unit[];

    @Column()
    leaders: User[];

    @Column()
    members: User[];

    @Column()
    responseConfiguration: ResponseConfiguration;

    @Column()
    alertSinks: GroupSink[];

    @Column()
    subGroups: Group[];

    constructor(
        name: string, 
        alertSinks: GroupSink[], 
        units: Unit[] = [],
        leaders: User[] = [],
        members: User[] = [],
        responseConfiguration: ResponseConfiguration,
        subGroups: Group[] = []){
            super();
            this.name = name;
            this.alertSinks = alertSinks;
            this.units = units;
            this.leaders = leaders;
            this.members = members;
            this.responseConfiguration = responseConfiguration;
            this.subGroups = subGroups;
    }

    private isRelevantAlert(alert: Alert): boolean{
        return this.units.some((unit) => unit.isMatchingAlert(alert));
    }

    public handleAlert(alert: Alert){
        if(this.isRelevantAlert(alert)){

            this.subGroups.forEach(subGroup => {
                subGroup.handleAlert(alert);
            });

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