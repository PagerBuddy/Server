import { DateTime, Duration } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, Relation } from "typeorm";
import User from "./user.js";

export enum PERMISSIONS {ALL, EDIT_ROUTING, EDIT_USER, EDIT_ALL_OUTPUTS, EDIT_ALL_SUBSCRIPTIONS, EDIT_LINKED_OUTPUT, SEND_USER_RESPONSE};

@Entity()
export default class AccessToken extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    token: string = "";

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
    createdTimeStamp: DateTime = DateTime.fromMillis(0);

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
    timeToLive: Duration = Duration.fromMillis(0);

    @ManyToOne(() => User, {eager: true, onDelete: "CASCADE"})
    user: Relation<User> = User.default;

    @Column({type: "enum", enum: PERMISSIONS, array: true})
    permissions: PERMISSIONS[] = [];

    //TODO: Generate actual token

    public static get default() : AccessToken{
        return AccessToken.create();
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