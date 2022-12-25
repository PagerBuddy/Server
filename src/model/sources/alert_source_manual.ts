import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import Alert from "../alert.js";
import AlertSource from "./alert_source.js";

/**
 * Dummy to identify manually triggered alerts.
 */
@ChildEntity()
export default class AlertSourceManual extends AlertSource{

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