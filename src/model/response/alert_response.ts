import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToOne, JoinColumn, ManyToOne, OneToMany, Equal, Relation } from "typeorm";
import Alert from "../alert.js";
import Group from "../group.js";
import UserResponse from "./user_response.js";

/**
 * An AlertResponse contains information regarding a group-specific response to an individual alert.
 */
@Entity()
export default class AlertResponse extends BaseEntity{

    @PrimaryGeneratedColumn()
    public id!: number;

    @Column()
    @ManyToOne(() => Alert, {eager: true, onDelete: "CASCADE"})
    public alert: Relation<Alert>;

    @Column()
    @ManyToOne(() => Group, {eager: true, onDelete: "CASCADE"})
    public group: Relation<Group>;

    @Column()
    @OneToMany(() => UserResponse, (response) => response.alertResponse, {eager: true, onDelete: "RESTRICT"})
    public responses: Relation<UserResponse>[];

    private updateCallbacks: ((update: AlertResponse) => void)[] = [];

    public constructor(alert: Alert = Alert.default, group: Group = Group.default, responses: UserResponse[] = []){
        super();
        this.alert = alert;
        this.group = group;
        this.responses = responses;

        //Propagate alert updates through to responses
        this.alert.registerUpdateCallback((update: Alert) => {
            //We can safetly assume the updated alert contains more information than the previous item
            this.alert = update;
            //We do not have to reregister, as the alert is fundamentally the same object

            this.updateCallbacks.forEach(callback => {
                callback(this);
            });
        });
    }

    public userResponded(newResponse: UserResponse): void {
        const oldResponse = this.responses.find((response) => response.user.equals(newResponse.user));

        if(oldResponse && oldResponse.response.equals(newResponse.response)){
            //Response is known and has not changed
            return;
        }else if(oldResponse){
            //Response is known, but has changed
            this.responses = this.responses.filter((response) => !response.equals(oldResponse));
            oldResponse.remove();
        }
        
        newResponse.alertResponse = this;
        newResponse.save();
        this.responses.push(newResponse);

        this.updateCallbacks.forEach(callback => {
            callback(this);
        });
        this.save();
    }

    public registerUpdateCallback(callback: (update: AlertResponse) => void){
        this.updateCallbacks.push(callback);
    }

    public getLocalisedResponses(timeZone: string, locale: string) : UserResponse[] {
        const userResponses = this.responses;
        userResponses.forEach(response => {
            response.timestamp = response.timestamp.setZone(timeZone).setLocale(locale);
        });
        return userResponses;
    }

    public static async fromId(id: number) : Promise<AlertResponse | null> {

        const alertResponse = await AlertResponse.findOne({
            where: {
                id: Equal(id)
            }
        });
        return alertResponse;
    }

}
