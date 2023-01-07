import { DateTime } from "luxon";
import { ChildEntity, Column } from "typeorm";
import KatSysConnector from "../../connectors/katsys.js";
import Alert from "../alert.js";
import AlertSource from "./alert_source.js";

@ChildEntity()
export default class AlertSourceKatSys extends AlertSource{

    @Column()
    private masterToken: string = "";

    @Column()
    private subToken: string = "";

    @Column()
    private certificate: string = "";

    @Column("text", {array: true})
    private decodeChannels: string[] = [];

    private katSysConnector?: KatSysConnector;

    public start() : void {
        this.katSysConnector = new KatSysConnector(
            {masterToken: this.masterToken, subToken: this.subToken, certificate: this.certificate}, 
            this.decodeChannels, 
            this.emitAlert,
            this.reportStatus);
    }

    public stop() : void {
        this.katSysConnector?.close();
    }

    protected reportStatus(timestamp: DateTime) : void{
        super.reportStatus(timestamp);
    }

    protected emitAlert(alert: Alert) : void{
        alert.sources = [this];
        super.emitAlert(alert);
    }
}