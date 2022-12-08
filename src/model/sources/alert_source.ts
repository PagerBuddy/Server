import { DateTime} from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import Alert from "../alert";

@Entity()
export default abstract class AlertSource extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    description: string;

    @Column()
    lastAlertTimestamp: DateTime;

    @Column()
    activeAlertTimeoutError: boolean = false;

    @Column()
    lastStatusTimestamp: DateTime;

    @Column()
    activeStatusTimeoutError: boolean = false;


    constructor(description: string, lastAlertTimestamp: DateTime, lastStatusTimestamp: DateTime){
        super();

        this.description = description;
        this.lastAlertTimestamp = lastAlertTimestamp;
        this.lastStatusTimestamp = lastStatusTimestamp;
    }

    public abstract start() : void;
    public abstract stop() : void;

    protected emitAlert(alert: Alert) : void {
        //TODO: Pass alert to alert router (singleton)
    }
}