import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, OneToMany } from "typeorm";
import AlertSink from "../sinks/alert_sink";
import User from "../user";
import AlertResponse from "./alert_response";
import ResponseOption, { RESPONSE_TYPE } from "./response_option";

@Entity()
export default class UserResponse extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: string;

    @Column()
    timestamp: DateTime;
    
    @Column()
    @ManyToOne(() => AlertSink)
    responseSource: AlertSink;

    @Column()
    @ManyToOne(() => User)
    user: User;

    @Column()
    @ManyToOne(() => ResponseOption)
    response: ResponseOption;

    @Column()
    @OneToMany(() => AlertResponse, (alertResponse) => alertResponse.responses)
    alertResponse!: AlertResponse;

    constructor(
        timestamp: DateTime, 
        responseSource: AlertSink, 
        user: User, 
        response: ResponseOption){
        super();
        this.timestamp = timestamp;
        this.responseSource = responseSource;
        this.user = user;
        this.response = response;
    }

    public static countResponsesForOption(userResponses: UserResponse[], option: ResponseOption) : number {
        return userResponses.filter((response) => response.response == option).length;
    }

    public static countResponsesForType(userResponses: UserResponse[], type: RESPONSE_TYPE) : number {
        return userResponses.filter((response) => response.response.type == type).length;
    }

    public static getResponsesForOption(userResponses: UserResponse[], option: ResponseOption) : UserResponse[] {
        return userResponses.filter((response) => response.response == option);
    }

    public static getResponsesForType(userResponses: UserResponse[], type: RESPONSE_TYPE) : UserResponse[] {
        return userResponses.filter((response) => response.response.type == type);
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
        if(this.response.enableEstimatedArrival){
            return this.timestamp.plus(this.response.estimatedArrivalOffset);
        }else{
            return DateTime.invalid("No ETA", "The selected reply option does not contain an estimated arrival.");
        }
    }
}