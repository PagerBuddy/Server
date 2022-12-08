import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import { isEntityName } from "typescript";
import Alert from "./alert";
import SilentConfiguration, { SilentNever } from "./silent_configuration";

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
    silentTime: SilentConfiguration;

    constructor(name: string, shortName: string, unitCode: number, silentTime: SilentConfiguration = new SilentNever()){
        super();
        this.name = name;
        this.shortName = shortName;
        this.unitCode = unitCode;
        this.silentTime = silentTime;
    }

    public isSilentTime(timestamp: DateTime) : boolean {
        return this.silentTime.isInSilentPeriod(timestamp);
    }

    public isMatchingAlert(alert: Alert) : boolean {
        return alert.unit.unitCode == this.unitCode;
    }

    /**
     * Search existing units for matching code. Returns a unit stub if no matchin unit is found.
     * @param unitCode 
     */
    public static fromUnitCode(unitCode: number) : Unit{
        //TODO: search db for matching units

        return new Unit("", "", unitCode);
    }
}

@Entity()
export class UnitSubscription extends BaseEntity{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    unit: Unit;

    @Column()
    active: boolean;

    constructor(unit: Unit, active: boolean = true){
        super();
        this.unit = unit;
        this.active = active;
    }

    public isMatchingAlert(alert: Alert): boolean{
        return this.unit.isMatchingAlert(alert);
    }
}
