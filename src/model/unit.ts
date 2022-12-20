import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, Equal } from "typeorm";
import { isEntityName } from "typescript";
import Alert from "./alert.js";
import SilentConfiguration, { SilentNever } from "./silent_configuration.js";

/**
 * A unit is the "ground" truth of an alertable "competence" - so a well defined someone/something which is 
 * layed out in an alert plan or similar. Units can be associated to many different people in different organisational 
 * structures. Explicit permission is required to receive alerts for a unit.
 */
@Entity()
export default class Unit extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column()
    name: string;

    @Column()
    shortName: string;

    @Column()
    unitCode: number;

    @Column()
    @ManyToOne(() => SilentConfiguration, {eager: true, onDelete: "RESTRICT"})
    silentTime: SilentConfiguration;

    constructor(
        name: string = "", 
        shortName: string = "", 
        unitCode: number = 0, 
        silentTime: SilentConfiguration = new SilentNever()){
        super();
        this.name = name;
        this.shortName = shortName;
        this.unitCode = unitCode;
        this.silentTime = silentTime;
    }

    public static get default() : Unit{
        return new Unit();
    }

    public isSilentTime(timestamp: DateTime) : boolean {
        return this.silentTime.isInSilentPeriod(timestamp);
    }

    public isMatchingAlert(alert: Alert) : boolean {
        return alert.unit.unitCode == this.unitCode;
    }

    /**
     * Search existing units for matching code. Returns a unit stub if no matching unit is found.
     * @param unitCode 
     */
    public static async fromUnitCode(unitCode: number) : Promise<Unit>{
        const unit = await Unit.findOne({
            where: {
                unitCode: Equal(unitCode)
            }
        });

        return unit ?? new Unit("", "", unitCode, new SilentNever(""));
    }
}

@Entity()
export class UnitSubscription extends BaseEntity{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    @ManyToOne(() => Unit, {eager: true, onDelete: "CASCADE"})
    unit: Unit;

    @Column()
    active: boolean;

    constructor(unit: Unit = Unit.default, active: boolean = true){
        super();
        this.unit = unit;
        this.active = active;
    }

    public isMatchingAlert(alert: Alert): boolean{
        return this.unit.isMatchingAlert(alert);
    }
}
