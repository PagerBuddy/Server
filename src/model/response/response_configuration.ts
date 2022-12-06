import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import ResponseOption from "./response_option";

@Entity()
export default class ResponseConfiguration extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    description: string;

    @Column()
    allowResponses: boolean;

    @Column()
    options: ResponseOption[];

    constructor(description: string, allowResponses: boolean = false, options: ResponseOption[] = []){
        super();
        this.description = description;
        this.allowResponses = allowResponses;
        this.options = options;
    }

    public addResponseOption(option: ResponseOption) : boolean {
        if(this.options.some((op) => op.id == option.id)){
            //Option is already in collection - do not add again
            return false;
        }else{
            this.options.push(option);
            return true;
        }
    }

    public removeResponseOption(option: ResponseOption) : boolean {
        if(this.options.some((op) => op.id == option.id)){
            //Option is in collection at least once - remove it
            this.options = this.options.filter((op) => op.id != option.id);
            return true;
        }else{
            //Option cannot be removed as it is not there
            return false;
        }
    }

    public getSortedResponseOptions() : ResponseOption[] {
        const responseOptions = this.options;
        responseOptions.sort((a, b) => {
            if(a.type != b.type){
                return a.type - b.type;
            }else{
                const aTime = a.enableEstimatedArrival ? a.estimatedArrivalOffset.toMillis() : Number.MAX_VALUE;
                const bTime = b.enableEstimatedArrival ? b.estimatedArrivalOffset.toMillis() : Number.MAX_VALUE;

                return aTime - bTime;
            }
        });

        return responseOptions;
    }
}