import { ChildEntity, ManyToOne, Relation } from "typeorm";
import alert from "../alert.js";
import Group from "../group.js";
import AlertResponse from "../response/alert_response.js";
import AlertSink from "./alert_sink.js";

@ChildEntity()
export default abstract class GroupSink extends AlertSink{

    @ManyToOne(() => Group)
    public group?: Relation<Group>; 

    public abstract sendAlert(alert: AlertResponse): Promise<void>;


    protected isRelevantAlert(alert: alert): boolean {
        return super.isRelevantAlert(alert);
    }
}