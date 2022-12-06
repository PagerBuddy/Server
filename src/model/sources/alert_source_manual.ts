import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertSource from "./alert_source";

/**
 * Dummy to identify manually triggered alerts.
 */
@ChildEntity()
export default class AlertSourceManual extends AlertSource{

    constructor(
        description: string, 
        lastAlertTimestamp: DateTime = DateTime.fromMillis(0), 
        lastStatusTimestamp: DateTime = DateTime.fromMillis(0)){
            super(description, lastAlertTimestamp, lastStatusTimestamp);
    }
}