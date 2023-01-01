import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, Equal, Relation } from "typeorm";
import { isEntityName } from "typescript";
import Alert from "./alert.js";
import SilentConfiguration, { SerialisableSilentConfiguration, SilentNever } from "./silent_configuration.js";

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
    name: string = "";

    @Column()
    shortName: string = "";

    @Column()
    unitCode: number = NaN;

    @ManyToOne(() => SilentConfiguration, {eager: true, onDelete: "RESTRICT"})
    silentTime: Relation<SilentConfiguration> = SilentNever.create();

    public static get default() : Unit{
        return Unit.create();
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

        return unit ?? Unit.create({unitCode: unitCode});
    }

    public getSerialisableUnit() : SerialisableUnit{
        return {
            name: this.name,
            shortName: this.shortName,
            unitCode: this.unitCode,
            silentTime: this.silentTime.getSerialisableSilentConfiguration()
        }
    }
}

@Entity()
export class UnitSubscription extends BaseEntity{
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => Unit, {eager: true, onDelete: "CASCADE"})
    unit: Relation<Unit> = Unit.default;

    @Column()
    active: boolean = true;

    public isMatchingAlert(alert: Alert): boolean{
        return this.unit.isMatchingAlert(alert);
    }
}

export type SerialisableUnit = {
    name: string,
    shortName: string,
    unitCode: number,
    silentTime: SerialisableSilentConfiguration
}
