import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import WebsocketConnector, { WebsocketSite } from "../../connectors/websocket";
import Alert from "../alert";
import AlertSource from "./alert_source";

@ChildEntity()
export default class AlertSourceHardwareInterface extends AlertSource{

    @Column()
    masterToken: string;

    @Column()
    subToken: string;

    @Column()
    certificate: string;

    @Column()
    siteId: string;

    private websocket?: WebsocketConnector;

    public constructor(
        description: string = "", 
        lastAlertTimestamp: DateTime = DateTime.fromMillis(0), 
        lastStatusTimestamp: DateTime = DateTime.fromMillis(0),
        masterToken: string = "",
        subToken: string = "",
        certificate: string = "",
        siteId: string = ""){
            super(description, lastAlertTimestamp, lastStatusTimestamp);

            this.masterToken = masterToken;
            this.subToken = subToken;
            this.certificate = certificate;
            this.siteId = siteId;
    }

    public async start(): Promise<void> {
        if(!this.websocket){
            this.websocket = await WebsocketConnector.getInstance();
            this.websocket.addSite(new WebsocketSite(this.siteId, this.emitAlert, this.reportStatus));
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