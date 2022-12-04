import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertSink from "../sinks/alert_sink";
import { User } from "../user.mjs";
import ResponseOption from "./response_option";

@Entity()
export default class UserResponse extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: string;

    @Column()
    timestamp: DateTime;
    
    @Column()
    responseSource: AlertSink;

    @Column()
    user: User;

    @Column()
    response: ResponseOption;

    constructor(timestamp: DateTime, responseSource: AlertSink, user: User, response: ResponseOption){
        super();
        this.timestamp = timestamp;
        this.responseSource = responseSource;
        this.user = user;
        this.response = response;
    }
}