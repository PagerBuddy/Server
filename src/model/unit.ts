import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
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

 

}
