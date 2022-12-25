import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertResponse from "../response/alert_response.js";
import UserResponse from "../response/user_response.js";
import { UnitSubscription } from "../unit.js";
import UserSink from "./user_sink.js";
import https from "https"
import Log from "../../log.js";

@ChildEntity()
export default class WebhookSink extends UserSink{

    private log = Log.getLogger(WebhookSink.name);

    @Column()
    url: string = "";

    public async sendAlert(alert: AlertResponse): Promise<void> {
        if(super.isRelevantAlert(alert.alert)){

            https.get(this.url, (result) => {
                //TODO: Handle/check result?
            }).on("error", (error: Error) => {
                this.log.debug("Error attempting to call webhook with url: " + this.url);
                this.log.debug(error);
            });

        }
    }


}