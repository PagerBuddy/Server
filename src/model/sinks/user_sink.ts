import { ChildEntity } from "typeorm";
import alert from "../alert.js";
import AlertResponse from "../response/alert_response.js";
import AlertSink from "./alert_sink.js";

@ChildEntity()
export default abstract class UserSink extends AlertSink{

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: alert): boolean {
        return super.isRelevantAlert(alert);
    }
}