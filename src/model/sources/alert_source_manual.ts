import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import Alert from "../alert";
import AlertSource from "./alert_source";

/**
 * Dummy to identify manually triggered alerts.
 */
@ChildEntity()
export default class AlertSourceManual extends AlertSource{


    public constructor(
        description: string = "", 
        lastAlertTimestamp: DateTime = DateTime.fromMillis(0), 
        lastStatusTimestamp: DateTime = DateTime.fromMillis(0)){
            super(description, lastAlertTimestamp, lastStatusTimestamp);
    }

    public start(): void {
    }
    public stop(): void {
    }

    protected reportStatus(timestamp: DateTime) : void{
        super.reportStatus(timestamp);
    }

    protected emitAlert(alert: Alert) : void {
        alert.sources = [this];
        super.emitAlert(alert);
    }
}