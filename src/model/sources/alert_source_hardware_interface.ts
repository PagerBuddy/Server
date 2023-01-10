import { DateTime } from "luxon";
import { ChildEntity, Column } from "typeorm";
import WebsocketConnector, { WebsocketSite } from "../../connectors/websocket.js";
import Alert from "../alert.js";
import AlertSource from "./alert_source.js";

@ChildEntity()
export default class AlertSourceHardwareInterface extends AlertSource{

    @Column()
    masterToken: string = "";

    @Column()
    subToken: string = "";

    @Column()
    certificate: string = "";

    @Column()
    siteId: string = "";

    private websocket?: WebsocketConnector;

    public async start(): Promise<void> {
        if(!this.websocket){
            this.websocket = await WebsocketConnector.getInstance();
            this.websocket?.addSite(new WebsocketSite(this.siteId, this.emitAlert, this.reportStatus));
        }
    }

    public stop(): void {
        this.websocket?.removeSite(this.siteId);
    }

    protected reportStatus(timestamp: DateTime) : void{
        super.reportStatus(timestamp);
    }

    protected emitAlert(alert: Alert) : void {
        alert.sources = [this];
        super.emitAlert(alert);
    }

}