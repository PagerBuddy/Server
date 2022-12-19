import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import AlertResponse from "../response/alert_response";
import UserResponse from "../response/user_response";
import { UnitSubscription } from "../unit";
import UserSink from "./user_sink";
import https from "https"
import Log from "../../log";

@ChildEntity()
export default class WebhookSink extends UserSink{

    private log = Log.getLogger(WebhookSink.name);

    @Column()
    url: string;

    public constructor(active: boolean = false, subscriptions: UnitSubscription[] = [], url: string = ""){
        super(active, subscriptions);
        this.url = url;
    }

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