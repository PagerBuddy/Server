import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, JoinTable, Equal } from "typeorm";
import AlertResponse from "./response/alert_response.js";
import UserSink from "./sinks/user_sink.js";

export enum USER_STATE {NONE, REQUEST_GROUP, INVITED, ACTIVE};
export enum USER_ROLE {STANDARD, ADMINISTRATOR, SUPER_ADMINISTRATOR};

@Entity()
export default class User extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column()
    eMail: string;

    @Column()
    telegramUserName?: string; //This is needed for alert responses in Telegram

    @Column()
    passwordHash: string;

    @Column()
    passwordSalt: string;

    @Column()
    status: USER_STATE;

    @Column()
    role: USER_ROLE;

    @Column()
    @ManyToMany(() => UserSink, {eager: true})
    @JoinTable()
    sinks: UserSink[];

    constructor(
        firstName: string = "", 
        lastName: string = "", 
        eMail: string = "", 
        passwordHash: string = "", 
        passwordSalt: string = "", 
        status: USER_STATE = USER_STATE.NONE, 
        role: USER_ROLE = USER_ROLE.STANDARD,
        sinks: UserSink[] = []){

        super();
        this.firstName = firstName;
        this.lastName = lastName;
        this.eMail = eMail;
        this.passwordHash = passwordHash;
        this.passwordSalt = passwordSalt;
        this.status = status;
        this.role = role;
        this.sinks = sinks;
    }

    public static get default() : User {
        return new User();
    }

    public equals(user: User): boolean{
        return user.id == this.id;
    }

    public handleAlert(alert: AlertResponse) : void {
        if(this.status == USER_STATE.ACTIVE){
            this.sinks.forEach(sink => {
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