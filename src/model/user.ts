import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, JoinTable, Equal, Relation } from "typeorm";
import AlertResponse from "./response/alert_response.js";
import UserSink from "./sinks/user_sink.js";

export enum USER_STATE {NONE, REQUEST_GROUP, INVITED, ACTIVE};
export enum USER_ROLE {STANDARD, ADMINISTRATOR, SUPER_ADMINISTRATOR};

@Entity()
export default class User extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    firstName: string = "";

    @Column()
    lastName: string = "";

    @Column()
    eMail: string = "";

    @Column()
    telegramUserName?: string; //This is needed for alert responses in Telegram

    @Column()
    passwordHash: string = "";

    @Column()
    passwordSalt: string = "";

    @Column()
    status: USER_STATE = USER_STATE.NONE;

    @Column()
    role: USER_ROLE = USER_ROLE.STANDARD;

    @ManyToMany(() => UserSink, {eager: true})
    @JoinTable()
    sinks?: Relation<UserSink>[];

    public static get default() : User {
        return User.create({sinks: []});
    }

    public equals(user: User): boolean{
        return user.id == this.id;
    }

    public handleAlert(alert: AlertResponse) : void {
        if(this.status == USER_STATE.ACTIVE){
            this.sinks?.forEach(sink => {
                sink.sendAlert(alert);
            });
        }
    }

    public getPrintName() : string {
        return `${this.firstName} ${this.lastName}`;
    }

    public static async fromTelegramName(userName: string) : Promise<User | null>{
        if(!userName || userName.length < 2){
            return null;
        }
        const user = await User.findOne({
            where: {
                telegramUserName: Equal(userName)
            }
        });

        return user;
    }


}