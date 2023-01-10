import { DateTime } from "luxon";
import { ChildEntity, Column } from "typeorm";
import TelegramConnector from "../../connectors/telegram.js";
import Log from "../../log.js";

import AlertResponse from "../response/alert_response.js";
import ResponseOption from "../response/response_option.js";
import UserResponse from "../response/user_response.js";
import User from "../user.js";
import GroupSink from "./group_sink.js";

@ChildEntity()
export default class TelegramSink extends GroupSink{

    @Column()
    chatId: number = NaN;

    @Column()
    enableForSilentAlert: boolean = false;

    @Column()
    private timeZone: string = "utc"; //As we are sending out parsed messages we must know the timezone of the intended recipients

    @Column()
    private locale: string = "en";

    private log = Log.getLogger(TelegramSink.name);

    public static async responseCallback(alertId: number, responseId: number, userName: string, chatId: number, timestamp: DateTime) : Promise<void> {
        const responseOption = await ResponseOption.fromID(responseId);
        const alert = await AlertResponse.fromId(alertId);

        const sink = alert?.group?.alertSinks?.find((sink) => {
            return sink instanceof TelegramSink && sink.chatId == chatId;
        });

        const user = await User.fromTelegramName(userName);
        const userInGroup = alert?.group?.members?.some((member) => member.id == user?.id);

        if(responseOption && sink && user && userInGroup){
            const userResponse = UserResponse.create({
                timestamp: timestamp,
                responseSource: sink,
                user: user,
                response: responseOption
            });
            alert?.userResponded(userResponse);
        }
    }

    public async sendAlert(alert: AlertResponse): Promise<void>{
        if (!alert.alert || !super.isRelevantAlert(alert.alert)) {
            // check first when nothing needs to be done -> simplifies this method
            return
        }
        
        //Convert timestamp to destination timezonealertMessageText
        const localisedAlert = alert.alert.getLocalisedCopy(this.timeZone, this.locale);

        const telegramConnector = TelegramConnector.getInstance();

        if(!telegramConnector){
            this.log.info("Telegram bot disabled. Cannot emit alert to Telegram.");
            return;
        }

        const alertResult = telegramConnector.sendAlert(this.chatId, localisedAlert);

        const messageResult = await alertResult.awaitableResult;
        if(!messageResult?.success){
            //Something went wrong
            return;
        }
        let alertAbortController = alertResult.cancellationToken;
        let alertMessageText = alertResult.messageText;

        let interfaceAbortController = new AbortController();
        let interfaceMessageId = 0;
        let interfaceMessageText = "";

        if(alert.group?.responseConfiguration?.allowResponses){
            const userResponses = alert.getLocalisedResponses(this.timeZone, this.locale);
            const interfaceResult = telegramConnector.sendResponseInterface(alert.id, this.chatId, userResponses, alert.group.responseConfiguration);
            interfaceAbortController = interfaceResult.cancellationToken;
            interfaceMessageId = (await interfaceResult?.awaitableResult)?.messageId ?? 0;
            interfaceMessageText = interfaceResult.messageText;
        }
    

        alert.registerUpdateCallback((update: AlertResponse) => {
            if(update.alert && messageResult.messageId != 0){
                alertAbortController.abort();

                const localisedUpdate = update.alert.getLocalisedCopy(this.timeZone, this.locale);
                const updateResult = telegramConnector.sendAlert(this.chatId, localisedUpdate);
                alertAbortController = updateResult.cancellationToken;
                alertMessageText = updateResult.messageText;
            }
            if(update.group?.responseConfiguration && interfaceMessageId != 0){
                interfaceAbortController.abort();

                const userResponses = update.getLocalisedResponses(this.timeZone, this.locale);
                const interfaceResult = telegramConnector.sendResponseInterface(
                    update.id, 
                    this.chatId, 
                    userResponses, 
                    update.group.responseConfiguration, 
                    interfaceMessageId, 
                    interfaceMessageText);
                interfaceAbortController = interfaceResult.cancellationToken;
                interfaceMessageText = interfaceResult.messageText;
            }
        });
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
    public static async migrateChatId(oldChatId: number, newChatId: number): Promise<void>{

        const relevantSinks = await TelegramSink.find({
            where: {
                chatId: oldChatId
            }
        });

        relevantSinks.forEach(sink => {
            sink.chatId = newChatId;
            sink.save();
        });
    }
}