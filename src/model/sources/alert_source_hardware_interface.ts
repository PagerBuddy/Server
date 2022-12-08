import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import Alert from "../alert";
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

    public start(): void {
    }
    public stop(): void {
    }

    protected emitAlert(alert: Alert) : void {
        super.emitAlert(alert);
    }

    //TODO: Handle interface connection stuff and super.emitAlert()
}