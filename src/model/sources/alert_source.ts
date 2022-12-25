import { DateTime} from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, TableInheritance } from "typeorm";
import AlertRouter from "../../alert_router.js";
import Alert from "../alert.js";

@Entity()
@TableInheritance({ column: { type: "varchar", name: "type" } })
export default abstract class AlertSource extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    description: string = "";

    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return DateTime.fromMillis(value);
            },
            to(value : DateTime) {
                return value.toMillis();
            },
        }
    })
    public lastAlertTimestamp: DateTime = DateTime.fromMillis(0);

    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return DateTime.fromMillis(value);
            },
            to(value : DateTime) {
                return value.toMillis();
            },
        }
    })
    public lastStatusTimestamp : DateTime = DateTime.fromMillis(0);

    public abstract start() : void;
    public abstract stop() : void;

    protected reportStatus(timestamp: DateTime) : void{
        this.lastStatusTimestamp = timestamp;
    }

    protected emitAlert(alert: Alert) : void {
        this.lastAlertTimestamp = alert.timestamp;
        AlertRouter.getInstance().handleAlert(alert);
    }
}