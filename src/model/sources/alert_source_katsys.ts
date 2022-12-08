import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import KatSysConnector from "../../connectors/katsys";
import Alert from "../alert";
import AlertSource from "./alert_source";

@ChildEntity()
export default class AlertSourceKatSys extends AlertSource{

    @Column()
    private masterToken: string;

    @Column()
    private subToken: string;

    @Column()
    private certificate: string;

    @Column()
    private decodeChannels: string[];

    private katSysConnector?: KatSysConnector;

    constructor(
        description: string, 
        lastAlertTimestamp: DateTime = DateTime.fromMillis(0), 
        lastStatusTimestamp: DateTime = DateTime.fromMillis(0),
        masterToken: string,
        subToken: string,
        certificate: string,
        decodeChannels: string[]){
            super(description, lastAlertTimestamp, lastStatusTimestamp);

            this.masterToken = masterToken;
            this.subToken = subToken;
            this.certificate = certificate;
            this.decodeChannels = decodeChannels; 
    }

    public start() : void {
        this.katSysConnector = new KatSysConnector(
            {masterToken: this.masterToken, subToken: this.subToken, certificate: this.certificate}, 
            this.decodeChannels, 
            this.emitAlert);
    }

    public stop() : void {
        this.katSysConnector?.close();
    }

    protected emitAlert(alert: Alert) : void{
        super.emitAlert(alert);
    }
}