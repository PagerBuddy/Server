import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToMany, JoinTable, Equal, Relation } from "typeorm";
import Group from "./group.js";
import AlertResponse from "./response/alert_response.js";
import UserSink from "./sinks/user_sink.js";
import Unit from "./unit.js";

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
    eMail: string = ""; //Perhaps this should be managed and retrieved from firebase instead of duplication

    @Column()
    telegramUserName?: string; //This is needed for alert responses in Telegram

    @Column()
    firebaseUID: string = ""; //This is the user in firebase auth and basically is a password to us

    @Column()
    status: USER_STATE = USER_STATE.NONE;

    @Column()
    role: USER_ROLE = USER_ROLE.STANDARD;

    @ManyToMany(() => UserSink, {eager: true})
    @JoinTable()
    sinks?: Relation<UserSink>[];

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

    public static async fromFirebaseUID(uid: string) : Promise<User|null> {
        if(!uid || uid.length == 0){ //block against empty uid
            return null;
        }

        const user = await User.findOne({
            where: {
                firebaseUID: Equal(uid)
            }
        });
        return user;
    }

    public async getAvailableUnits() : Promise<Unit[]>{
        //TODO: I am sure this can be solved more elegantly with TypeORM

        const groupList = await Group.find();
        const unitList : Unit[] = [];
        groupList.forEach(group => {
            if(group.members?.includes(this) && group.units){
                unitList.push(... group.units);
            }
        });

        return unitList;
    }


}