import { Duration } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Equal } from "typeorm";

export enum RESPONSE_TYPE {CONFIRM, DELAY, DENY};

@Entity()
export default class ResponseOption extends BaseEntity{

    @PrimaryGeneratedColumn()
    public id!: number;

    @Column()
    public label: string = "";

    @Column()
    public enableEstimatedArrival: boolean = false;

    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return Duration.fromMillis(value);
            },
            to(value : Duration) {
                return value.toMillis();
            },
        }
    })
    public estimatedArrivalOffset: Duration = Duration.fromMillis(0);


    @Column()
    public type: RESPONSE_TYPE = RESPONSE_TYPE.DENY;
    
    public static get default() : ResponseOption {
        return ResponseOption.create();
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