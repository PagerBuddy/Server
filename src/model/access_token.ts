import { DateTime, Duration } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne } from "typeorm";
import User from "./user";

export enum PERMISSIONS {ALL, EDIT_ROUTING, EDIT_USER, EDIT_ALL_OUTPUTS, EDIT_ALL_SUBSCRIPTIONS, EDIT_LINKED_OUTPUT, SEND_USER_RESPONSE};

@Entity()
export default class AccessToken extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    token: string;

    @Column()
    createdTimeStamp: DateTime;

    @Column()
    timeToLive: Duration;

    @Column()
    @ManyToOne(() => User, {eager: true, onDelete: "CASCADE"})
    user: User;

    @Column()
    permissions: PERMISSIONS[];

    constructor(
        createdTimeStamp: DateTime = DateTime.fromMillis(0), 
        timeToLive: Duration = Duration.fromMillis(0), 
        user: User = User.default, 
        permissions: PERMISSIONS[] = []){
        super();

        //TODO: Generate token here
        this.token = "";

        this.createdTimeStamp = createdTimeStamp;
        this.timeToLive = timeToLive;
        this.user = user;
        this.permissions = permissions;
    }

    /**
     * Check if a token is valid (i.e. has not reached end of life) at a specific timestamp (typically now).
     * @param {DateTime} currentTimestamp
     * @returns {boolean}
     */
    public isActive(currentTimestamp: DateTime = DateTime.now()) : boolean{
        const endOfLife = this.createdTimeStamp.plus(this.timeToLive);
        return endOfLife < currentTimestamp;
    }




}