import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, JoinTable } from "typeorm";
import AlertResponse from "./response/alert_response";
import UserSink from "./sinks/user_sink";

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
    @ManyToMany(() => UserSink)
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

    public static fromTelegramName(userName: string) : User | undefined{
        //TODO: Find user as a match of userName
        return undefined;
    }


}