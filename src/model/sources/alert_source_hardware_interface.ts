import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertSource from "./alert_source";

@ChildEntity()
export default class AlertSourceHardwareInterface extends AlertSource{

    @Column()
    masterToken: string;

    @Column()
    subToken: string;

    @Column()
    certificate: string;

    constructor(
        description: string, 
        lastAlertTimestamp: DateTime = DateTime.fromMillis(0), 
        lastStatusTimestamp: DateTime = DateTime.fromMillis(0),
        masterToken: string,
        subToken: string,
        certificate: string){
            super(description, lastAlertTimestamp, lastStatusTimestamp);

            this.masterToken = masterToken;
            this.subToken = subToken;
            this.certificate = certificate;
    }

    //TODO: Handle interface connection stuff and super.emitAlert()
}