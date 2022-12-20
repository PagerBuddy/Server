import Alert, { INFORMATION_CONTENT } from "../model/alert.js";
import * as  http from 'http';
import { Server } from "socket.io";
import Log from "../log.js";
import Unit from "../model/unit.js";
import { DateTime } from "luxon";
import SystemConfiguration from "../model/system_configuration.js";

export default class WebsocketConnector{

    private static instance: WebsocketConnector;
    
    private log = Log.getLogger(WebsocketConnector.name);

    private server? : http.Server;
    private io?: Server;

    private subscriptions : WebsocketSite[] = [];

    public static async getInstance() : Promise<WebsocketConnector | undefined>{
        if(!SystemConfiguration.websocketEnabled){
            return undefined
        }
        if(!this.instance){
            this.instance = new WebsocketConnector();
            await this.instance.connect();
        }
        return this.instance;
    }

    public addSite(websocketSite: WebsocketSite) : void{
        if(!this.subscriptions.some(site => site.siteId == websocketSite.siteId)){
            this.subscriptions.push(websocketSite);
        }
    }

    public removeSite(siteId: string) : void{
        this.subscriptions = this.subscriptions.filter(sub => sub.siteId != siteId);
        if(this.subscriptions.length == 0){
            this.close();
            WebsocketConnector.instance = undefined as unknown as WebsocketConnector;
        }
    }

    private async connect() : Promise<boolean> {

        const requestListener = function (req : http.IncomingMessage, res : http.ServerResponse) {
            res.writeHead(404);
            res.end();
        };
    
        const server = http.createServer(requestListener);
        const io = new Server(server);
    
        io.on('connection', (socket) => {
            this.log.debug('A connection to an alert interface was established.');

            socket.on('health', (data : WebsocketHealthData) => {
                this.subscriptions.forEach(subscription => {
                    if(subscription.siteId == data.siteId){
                        subscription.handleStatus(DateTime.fromMillis(data.timestamp,  {zone: "utc"}));
                    }
                });
            });
            socket.on('zvei', async (data : WebsocketZveiData) => {
                this.log.debug(`Received ZVEI alert ${data.zvei} from ${data.siteId}`);
                
                await this.handleAlert(data);
            });
            socket.on('aprt', async (data : WebsocketAprtData) => {
                this.log.debug(`Received APRT alert ${data.subZvei} from ${data.siteId}`);

                await this.handleAlert(data);
            });
            socket.on('status', (data : WebSocketStatusData) => {
                //TODO: Eventually do something with this info
            });
            socket.on('disconnect', () => {
                this.log.debug('An alert interface disconnected.');
            });
        });
    
        server.on('error', (e : Error & {code: string}) => {
            if (e.code == 'EADDRINUSE') {
                this.log.error(`Address in use ${SystemConfiguration.websocketPort}. This is fatal for incoming interfaces. Probably a different instance is already active.`);
            }
        });
    
        return new Promise((resolve) => {
            server.listen(SystemConfiguration.websocketPort, () => {
                this.log.debug(`Listening on port ${SystemConfiguration.websocketPort} for incoming websocket connections.`);

                this.server = server;
                this.io = io;
                resolve(true);
            });
        });
    }

    private async handleAlert(websocketAlert: WebsocketZveiData | WebsocketAprtData): Promise<void>{

        const timestamp = DateTime.fromMillis(websocketAlert.timestamp, {zone: "utc"});

        let keyword = "";
        let location = "";
        let unitId : number;
        let informationContent : INFORMATION_CONTENT;

        if(isWebsocketAprtData(websocketAlert)){
            keyword = websocketAlert.emergencyReason;
            location = websocketAlert.emergencyCity;
            unitId = parseInt(websocketAlert.subZvei);
            informationContent = INFORMATION_CONTENT.KEYWORD;
        }else{
            unitId = parseInt(websocketAlert.zvei);
            informationContent = INFORMATION_CONTENT.ID;
        }

        const sAlert = new Alert(
            await Unit.fromUnitCode(unitId), 
            timestamp, 
            informationContent,
            keyword,
            "",
            location,
            []);
        
        this.subscriptions.forEach(subscription => {
            if(subscription.siteId == websocketAlert.siteId){
                subscription.handleAlert(sAlert);
            }
        });
    }

    private close(){
        this.io?.close();
        this.server?.close();
    } 
}

export class WebsocketSite{
    public siteId: string;
    private alertCallback: (alert: Alert) => void;
    private statusCallback: (timestamp: DateTime) => void;

    constructor(siteId: string, alertCallback: (alert: Alert) => void, statusCallback: (timestamp: DateTime) => void){
        this.siteId = siteId;
        this.alertCallback = alertCallback;
        this.statusCallback = statusCallback;
    }

    public handleAlert(alert: Alert) : void{
        this.alertCallback(alert);
    }

    public handleStatus(timestamp: DateTime) : void{
        this.statusCallback(timestamp);
    }
}

type WebsocketData = {
    siteId: string,
    type: "health"|"zvei"|"status"|"aprt"
}

type WebsocketHealthData = WebsocketData & {
    device: string,
    status: string,
    group: string,
    csq: string,
    timestamp: number
}

type WebsocketZveiData = WebsocketData & {
    zvei: string,
    timestamp: number
}

type WebsocketAprtData = WebsocketData & {
    subZvei: string,
    subDec: string,
    subHex: string,
    emergencyReason: string,
    emergencyCity: string,
    emergencySite: string,
    from: string,
    to: string,
    timestamp: number
}
function isWebsocketAprtData(a: any): a is WebsocketAprtData{
    return a.type == "aprt";
}

type WebSocketStatusData = WebsocketData & {
    status: string,
    sender: string,
    timestamp: number
}