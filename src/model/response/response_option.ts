import { Duration } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Equal } from "typeorm";

export enum RESPONSE_TYPE {CONFIRM, DELAY, DENY};

@Entity()
export default class ResponseOption extends BaseEntity{

    @PrimaryGeneratedColumn()
    public id!: number;

    @Column()
    public label: string;

    @Column()
    public enableEstimatedArrival: boolean;

    @Column()
    public estimatedArrivalOffset: Duration;

    @Column()
    public type: RESPONSE_TYPE;

    public constructor(
        label: string = "", 
        type: RESPONSE_TYPE = RESPONSE_TYPE.DENY, 
        enableEstimatedArrival: boolean = false, 
        estimatedArrivalOffset: Duration = Duration.fromMillis(0)){
        super();
        this.label = label;
        this.type = type;
        this.enableEstimatedArrival = enableEstimatedArrival;
        this.estimatedArrivalOffset = estimatedArrivalOffset;
    }
    
    public static get default() : ResponseOption {
        return new ResponseOption();
    }

    public equals(responseOption: ResponseOption): boolean {
        return responseOption.id == this.id;
    }

    public static async fromID(id: number) : Promise<ResponseOption | null> {
        const responseoption = await ResponseOption.findOne({
            where: {
                id: Equal(id)
            }
        });

        return responseoption;
    }
}