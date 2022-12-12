import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToOne, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import Alert from "../alert";
import Group from "../group";
import { User } from "../user.mjs";
import UserResponse from "./user_response";

/**
 * An AlertResponse contains information regarding a group-specific response to an individual alert.
 */
@Entity()
export default class AlertResponse extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    @ManyToOne(() => Alert, {eager: true})
    public alert: Alert;

    @Column()
    @ManyToOne(() => Group)
    public group: Group;

    @Column()
    @OneToMany(() => UserResponse, (response) => response.alertResponse)
    responses: UserResponse[];

    private updateCallbacks: ((update: AlertResponse) => void)[] = [];

    public constructor(alert: Alert, group: Group, responses: UserResponse[] = []){
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
        //TODO: Update responses - check for change
        //Notify sinks on info update

        this.updateCallbacks.forEach(callback => {
            callback(this);
        });
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

    public static fromId(id: number) : AlertResponse | undefined {
        //TODO: search all for id match
        return undefined;
    }

}
