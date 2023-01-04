import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, OneToMany, Relation } from "typeorm";
import AlertSink from "../sinks/alert_sink.js";
import User from "../user.js";
import AlertResponse from "./alert_response.js";
import ResponseOption, { RESPONSE_TYPE } from "./response_option.js";

@Entity()
export default class UserResponse extends BaseEntity{

    @PrimaryGeneratedColumn()
    private id!: string;

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
    public timestamp: DateTime = DateTime.fromMillis(0);
    
    @ManyToOne(() => AlertSink, {eager: true, onDelete: "RESTRICT"})
    public responseSource?: Relation<AlertSink>;

    @ManyToOne(() => User, {eager: true, onDelete: "CASCADE"})
    public user?: Relation<User>;

    @ManyToOne(() => ResponseOption, {eager: true, onDelete: "RESTRICT"})
    public response?: Relation<ResponseOption>;

    @OneToMany(() => AlertResponse, (alertResponse) => alertResponse.responses, {onDelete: "CASCADE"})
    public alertResponse?: Relation<AlertResponse>;


    public equals(userResponse: UserResponse): boolean{
        return userResponse.id == this.id;
    }

    public static countResponsesForOption(userResponses: UserResponse[], option: ResponseOption) : number {
        return userResponses.filter((response) => response.response == option).length;
    }

    public static countResponsesForType(userResponses: UserResponse[], type: RESPONSE_TYPE) : number {
        return userResponses.filter((response) => response.response?.type == type).length;
    }

    public static getResponsesForOption(userResponses: UserResponse[], option: ResponseOption) : UserResponse[] {
        return userResponses.filter((response) => response.response == option);
    }

    public static getResponsesForType(userResponses: UserResponse[], type: RESPONSE_TYPE) : UserResponse[] {
        return userResponses.filter((response) => response.response?.type == type);
    }

    public static sortByEstimatedArrival(userResponses: UserResponse[]): UserResponse[] {
        userResponses.sort((a, b) => {
            const aTime = a.getEstimatedArrival();
            const bTime = b.getEstimatedArrival();

            let aStamp = Number.MAX_SAFE_INTEGER;
            let bStamp = Number.MAX_SAFE_INTEGER;

            if(aTime.isValid){
                aStamp = aTime.toMillis();
            }

            if(bTime.isValid){
                bStamp = bTime.toMillis();
            }

            return aStamp - bStamp;
        });
        return userResponses;
    } 

    public getEstimatedArrival() : DateTime {
        if(this.response?.enableEstimatedArrival){
            return this.timestamp.plus(this.response.estimatedArrivalOffset);
        }else{
            return DateTime.invalid("No ETA", "The selected reply option does not contain an estimated arrival.");
        }
    }
}