import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Timestamp, ChildEntity, OneToOne, JoinColumn, Relation, Equal } from "typeorm";
import FirebaseConnector from "../../connectors/firebase.js";
import Log from "../../log.js";
import AlertResponse from "../response/alert_response.js";
import UserResponse from "../response/user_response.js";
import { UnitSubscription } from "../unit.js";
import UserSink from "./user_sink.js";

@ChildEntity()
export default class AppSink extends UserSink{

    @Column()
    deviceToken: string = "";

    @Column()
    deviceID: string = ""; //This is a unique hardware ID of the user device - used to ensure we can detect token changes

    @Column()
    alertSound: string = "";

    @Column()
    alertVolume: number = 1;

    @Column()
    silentAlertVolume: number = 0.5;

    @Column()
    timeZone: string = "utc";

    @Column()
    locale: string = "en";

    private log = Log.getLogger(AppSink.name);

    private invalidTokenCallback() : void {
        //TODO: Remove invalid token?
        //Probably send some http request to app for update
    }


    public async sendAlert(alert: AlertResponse): Promise<void> {
        if(super.isRelevantAlert(alert.alert)){

            const alertPayload = alert.alert.getSerialisableAlert();
            const configuration = {
                alertSound: this.alertSound,
                alertVolume: this.alertVolume,
                silentAlertVolume: this.silentAlertVolume,
                timeZone: this.timeZone,
                locale: this.locale
            };

            const firebase = await FirebaseConnector.getInstance();
            if(firebase){
                firebase.sendAlert(this.deviceToken, alertPayload, configuration, this.invalidTokenCallback);

                alert.registerUpdateCallback(async (update: AlertResponse) => {
                    const updatePayload = update.alert.getSerialisableAlert();
    
                    firebase.sendAlert(this.deviceToken, updatePayload, configuration, this.invalidTokenCallback);
                });

            }else{
                this.log.info("Firebase disabled. Cannot emit alert to FCM.");
            }

        }
    }

}