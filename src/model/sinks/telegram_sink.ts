import { DateTime } from "luxon";
import { ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";
import TelegramConnector from "../../connectors/telegram";
import Alert from "../alert";
import AlertResponse from "../response/alert_response";
import ResponseOption from "../response/response_option";
import UserResponse from "../response/user_response";
import { UnitSubscription } from "../unit";
import User from "../user";
import GroupSink from "./group_sink";

@ChildEntity()
export default class TelegramSink extends GroupSink{

    @Column()
    chatId: number;

    @Column()
    enableForSilentAlert: boolean;

    @Column()
    private timeZone: string; //As we are sending out parsed messages we must know the timezone of the intended recipients

    @Column()
    private locale: string;

    public constructor(
        active: boolean = false, 
        subscriptions: UnitSubscription[] = [], 
        chatId: number = 0, 
        enableForSilentAlert: boolean = true, 
        timeZone: string = "utc", 
        locale: string = "en"){
        super(active, subscriptions);
        this.chatId = chatId;
        this.enableForSilentAlert = enableForSilentAlert;

        const tempTime = DateTime.now().setZone(timeZone).setLocale(locale);
        if(!tempTime.isValid){
            throw Error("The specified time zone or locale string is not valid.");
        }

        this.timeZone = timeZone;
        this.locale = locale;
    }

    public static async responseCallback(alertId: number, responseId: number, userName: string, chatId: number, timestamp: DateTime) : Promise<void> {
        const responseOption = await ResponseOption.fromID(responseId);
        const alert = await AlertResponse.fromId(alertId);

        const sink = alert?.group.alertSinks.find((sink) => {
            return sink instanceof TelegramSink && sink.chatId == chatId;
        });

        const user = User.fromTelegramName(userName);
        const userInGroup = alert?.group.members.some((member) => member.id == user?.id);

        if(responseOption && sink && user && userInGroup){
            const userResponse = new UserResponse(timestamp, sink, user, responseOption);
            alert?.userResponded(userResponse);
        }
    }

    public async sendAlert(alert: AlertResponse): Promise<void>{
        if(super.isRelevantAlert(alert.alert)){

            //Convert timestamp to destination timezone
            const localisedAlert = alert.alert.getLocalisedCopy(this.timeZone, this.locale);

            const telegramConnector = TelegramConnector.getInstance();
            const alertResult = telegramConnector.sendAlert(this.chatId, localisedAlert);

            const messageResult = await alertResult.awaitableResult;
            if(!messageResult.success){
                //Something went wrong
                return;
            }
            let alertAbortController = alertResult.cancellationToken;
            let alertMessageText = alertResult.messageText;

            let interfaceAbortController = new AbortController();
            let interfaceMessageId = 0;
            let interfaceMessageText = "";

            if(alert.group.responseConfiguration.allowResponses){
                const userResponses = alert.getLocalisedResponses(this.timeZone, this.locale);
                const interfaceResult = telegramConnector.sendResponseInterface(alert.id, this.chatId, userResponses, alert.group.responseConfiguration);
                interfaceAbortController = interfaceResult.cancellationToken;
                interfaceMessageId = (await interfaceResult.awaitableResult).messageId;
                interfaceMessageText = interfaceResult.messageText;
            }
        

            alert.registerUpdateCallback((update: AlertResponse) => {
                if(messageResult.messageId != 0){
                    alertAbortController.abort();

                    const localisedUpdate = update.alert.getLocalisedCopy(this.timeZone, this.locale);
                    const updateResult = telegramConnector.sendAlert(this.chatId, localisedUpdate);
                    alertAbortController = updateResult.cancellationToken;
                    alertMessageText = updateResult.messageText;
                }
                if(interfaceMessageId != 0){
                    interfaceAbortController.abort();

                    const userResponses = update.getLocalisedResponses(this.timeZone, this.locale);
                    const interfaceResult = telegramConnector.sendResponseInterface(update.id, this.chatId, userResponses, update.group.responseConfiguration, interfaceMessageId, interfaceMessageText);
                    interfaceAbortController = interfaceResult.cancellationToken;
                    interfaceMessageText = interfaceResult.messageText;
                }
            });
        }
    }

    /**
     * In some scenarios the chatID of a Telegram chat will change (max. one time). The bot will be able to detect
     * such a migration event from the error response.
     * @param newChatId 
     */
    public migrateChatId(newChatId: number) : void {
        this.chatId = newChatId;
    }

    /**
     * As a migration error can occur anywhere in a Telegram operation and many different sinks may be using
     * the same chatID, we need a helper to change all relevant IDs once.
     * @param oldChatId 
     * @param newChatId 
     */
    public static migrateChatId(oldChatId: number, newChatId: number): void{
        //TODO: Iterate instances and search for all occurances of oldId
    }
}