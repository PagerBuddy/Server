import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import TelegramConnector from "../../connectors/telegram";
import Alert from "../alert";
import AlertResponse from "../response/alert_response";
import { UnitSubscription } from "../unit";
import GroupSink from "./group_sink";

@Entity()
export default class TelegramSink extends GroupSink{

    @Column()
    chatId: number;

    @Column()
    enableForSilentAlert: boolean;

    @Column()
    timeZone: string; //As we are sending out parsed messages we must know the timezone of the intended recipients

    @Column()
    locale: string;

    constructor(active: boolean = true, subscriptions: UnitSubscription[] = [], chatId: number, enableForSilentAlert: true, timeZone: string, locale: string){
        super(active, subscriptions);
        this.chatId = chatId;
        this.enableForSilentAlert = enableForSilentAlert;

        const tempTime = DateTime.local().setZone(timeZone).setLocale(locale);
        if(!tempTime.isValid){
            throw Error("The specified time zone or locale string is not valid.");
        }

        this.timeZone = timeZone;
        this.locale = locale;
    }

    async sendAlert(alert: AlertResponse): Promise<void>{
        if(super.isRelevantAlert(alert.alert)){

            //Convert timestamp to destination timezone
            const localisedAlert = new Alert(
                alert.alert.unit, 
                alert.alert.timestamp.setZone(this.timeZone).setLocale(this.locale),
                alert.alert.informationContent,
                alert.alert.keyword,
                alert.alert.message,
                alert.alert.location,
                alert.alert.sources);

            //TODO: send alert to Telegram
            const telegramConnector = TelegramConnector.getInstance();
            const msgResult = await telegramConnector.sendAlert(this.chatId, localisedAlert);

            if(!msgResult.success){
                //Something went wrong
                return;
            }

            let abortController = new AbortController();
            let interfaceMessageId = 0;
            let interfaceMessageText = "";

            if(alert.group.responseConfiguration.allowResponses){
                const userResponses = alert.getLocalisedResponses(this.timeZone, this.locale);
                const interfaceResult = telegramConnector.sendResponseInterface(this.chatId, userResponses, alert.group.responseConfiguration);
                abortController = interfaceResult.cancellationToken;
                interfaceMessageId = (await interfaceResult.awaitableResult).messageId;
                interfaceMessageText = interfaceResult.messageText;
            }
        

            alert.registerUpdateCallback((update: AlertResponse) => {
                if(interfaceMessageId != 0){
                    abortController.abort();

                    const userResponses = update.getLocalisedResponses(this.timeZone, this.locale);
                    const interfaceResult = telegramConnector.sendResponseInterface(this.chatId, userResponses, update.group.responseConfiguration, interfaceMessageId, interfaceMessageText);
                    abortController = interfaceResult.cancellationToken;
                    interfaceMessageText = interfaceResult.messageText;
                }
                //TODO: Handle updates

            });
        }
        
    }
}