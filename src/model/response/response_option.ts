import { Duration } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

export enum RESPONSE_TYPE {CONFIRM, DELAY, DENY};

@Entity()
export default class ResponseOption extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    label: string;

    @Column()
    enableEstimatedArrival: boolean;

    @Column()
    estimatedArrivalOffset: Duration;

    @Column()
    type: RESPONSE_TYPE;

    constructor(label: string, type: RESPONSE_TYPE, enableEstimatedArrival: boolean = false, estimatedArrivalOffset: Duration = Duration.fromMillis(0)){
        super();
        this.label = label;
        this.type = type;
        this.enableEstimatedArrival = enableEstimatedArrival;
        this.estimatedArrivalOffset = estimatedArrivalOffset;
    }

    public static fromID(id: number) : ResponseOption | undefined {
        //TODO: search options for Id and return
        return undefined;
    }
}