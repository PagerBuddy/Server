import Log from "../log";
import WebSocket from "ws";
import Alert, {INFORMATION_CONTENT} from "../model/alert";
import KatSysAlert from "../model/katsys/katsys_alert";
import Unit from "../model/unit";
import { DateTime } from "luxon";

//Ref: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
const CODE_PAGERBUDDY_STOP = 4000;

export default class KatSysConnector{

    private log = Log.getLogger(KatSysConnector.name);

    private connectionParameters: KatSysConnectionParameters;
    private decodeChannels: string[];

    private alertCallback: (alert: Alert) => void;
    private statusCallback: (timestamp: DateTime) => void;

    private socket: WebSocket;

    //These are constants of the KatSys server
    private static CONNECTION_URL = "wss://connect.katsys.cloud:81";
    private static TIMEZONE = "Europe/Berlin";

    constructor(
        connectionParameters: KatSysConnectionParameters, 
        decodeChannels: string[], 
        alertCallback: (alert: Alert) => void,
        statusCallback: (timestamp: DateTime) => void){
            this.connectionParameters = connectionParameters;
            this.decodeChannels = decodeChannels;
            this.alertCallback = alertCallback;
            this.statusCallback = statusCallback;

            this.socket = this.connect();
    }

    private connect() : WebSocket {

        const socket = new WebSocket(KatSysConnector.CONNECTION_URL, {
            ca: [this.connectionParameters.certificate],
            headers: {
                "master_token": this.connectionParameters.masterToken,
                "sub_token": this.connectionParameters.subToken
            }
        });

        socket.on("open", () => {
            this.log.debug('Connection to KatSys was established.');
            this.statusCallback(DateTime.now());
        });
        socket.on("close", (code: number) => {
            switch (code) {
                case CODE_PAGERBUDDY_STOP:
                    //Do nothing as the socket is shutting down purposefully
                    break;
                default:
                    this.log.debug('KatSys connection closed. Reopening...');
                    setTimeout(() => {
                        this.socket = this.connect(); 
                    }, 1000 * 10); //Delay 10s before reconnection attempt
            }
        });
        socket.on("error", (error: any) => {
            this.log.error("An error occured on KatSys socket: " + error.message);
        });
        socket.on("ping", () => {
            this.statusCallback(DateTime.now());
        });
        socket.on("message", async (data: string) => {
            const jsonData = JSON.parse(data) as KatSysJsonUpdate;
        
            if (jsonData.statusClass == "success") {
                this.log.silly("KatSys status: " + jsonData.statusCode)
            } else {
                this.log.warn("KatSys status: " + jsonData.statusCode);
                return;
            }
    
            if (jsonData.statusCode == "alarm_data" && jsonData.data) {
                const alert = new KatSysAlert(jsonData.data.textElements, KatSysConnector.TIMEZONE);
                await this.handle_alert(alert);
            }
    
        });

        return socket;
    }
    
    public close() : void {
        if (this.socket?.readyState > 0) {
            this.socket.close(CODE_PAGERBUDDY_STOP);
        }
    }
        
    /**
     * Handle an incoming alert. Trigger callback for each viable alert in data.
     * @param {KatSysAlert} alert_data 
     * @returns {void}
     */
    private async handle_alert(katSysAlert: KatSysAlert) : Promise<void> {

        katSysAlert.getRelevantSchleifen(this.decodeChannels).forEach(async schleife => {
            const sAlert = new Alert(
                await Unit.fromUnitCode(schleife.unitId),
                schleife.alertTimestamp,
                INFORMATION_CONTENT.COMPLETE,
                katSysAlert.keyword,
                "",
                katSysAlert.location,
                []);
            
            this.alertCallback(sAlert);
        });
    }
}

export type KatSysConnectionParameters = {
    masterToken: string,
    subToken: string,
    certificate: string
}

type KatSysJsonUpdate = {
    type: string,
    statusCode: string,
    statusClass: string,
    data?: {textElements: KatSysJsonAlert}
}

export type KatSysJsonAlert = {
    alarmdatum: string, //01.01.2022
    alarmuhrzeit: string, //10:10:10
    einsatzort: string, //91000 Wunschort - Wunschort
    ort: string, //Wunschort
    plz: string, //91000
    strasse: string //Wunschstrasse
    hausnummer: string //1
    schlagwort: string, //#R9012#KTP#KTP - Heimfahrt
    schleifen_delta: string //123 25123 10:10\nRD_NN 5123 10:10
}