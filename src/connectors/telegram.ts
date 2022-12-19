import TelegramBot from "node-telegram-bot-api";
import PQueue, { AbortError } from "p-queue";
import http from "node:http";
import Alert from "../model/alert"
import { DateTime } from "luxon";
import UserResponse from "../model/response/user_response";
import ResponseOption, { RESPONSE_TYPE } from "../model/response/response_option";
import ResponseConfiguration from "../model/response/response_configuration";
import TelegramSink from "../model/sinks/telegram_sink";
import Log from "../log";
import SystemConfiguration from "../model/system_configuration";

//Telegram markup constants
const LINE_BREAK = "\n";
const BOLD_START = "<b>";
const BOLD_END = "</b>";

const PAGERBUDDY_URL = "https://pagerbuddy.org";

export default class TelegramConnector {

    //This must be a singleton
    private static instance: TelegramConnector;

    //We need a queue to limit telegram requests
    private outputQueue: PQueue;

    private static PRIORITY_ALERT = 10;
    private static PRIORITY_STANDARD = 0;

    //The bot instance used for all requests to API
    private telegramBot: TelegramBot;

    //No offical numbers for flood limits exist - here is an unoffical overview: https://limits.tginfo.me/en
    //10 messages per second seems to be safe
    private static OUPUT_PER_SECOND = 10;

    //Status indicator
    public errorStatusSince: DateTime = DateTime.invalid("Placeholder");

    private log = Log.getLogger(TelegramConnector.name);

    private constructor() {
        this.outputQueue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: TelegramConnector.OUPUT_PER_SECOND });

        this.telegramBot = new TelegramBot(SystemConfiguration.telegramBotToken, {
            polling: true,
            onlyFirstMatch: true
        });

        this.telegramBot.on("error", this.botErrorOperation);
        this.telegramBot.on("polling_error", this.botErrorOperation)

        this.telegramBot.on("callback_query", async (query: TelegramBot.CallbackQuery) => {
            this.handleCallback(query);
            try {
                await this.telegramBot.answerCallbackQuery(query.id);
            } catch (error) {
                // This can take too long and timeout
            }
        });
    }

    public static getInstance(): TelegramConnector | undefined {
        if (!SystemConfiguration.telegramBotEnabled) {
            return undefined;
        }
        if (!TelegramConnector.instance) {
            TelegramConnector.instance = new TelegramConnector();
        }
        return TelegramConnector.instance;
    }

    public sendAlert(
        chatId: number,
        alert: Alert,
        msgId: number = 0,
        msgText: string = ""): { awaitableResult: Promise<TelegramSendResult>, cancellationToken: AbortController, messageText: string } {
        let outText: string[] = [];

        if (alert.isManualAlert) {
            outText.push(BOLD_START, "Manueller Alarm (KEINE ILS)", BOLD_END, LINE_BREAK);
        } else if (alert.isSilentAlert) {
            outText.push(BOLD_START, "Probealarmzeit", BOLD_END, LINE_BREAK);
        }
        outText.push(alert.keyword, LINE_BREAK, alert.location, LINE_BREAK);
        outText.push(alert.unit.name, LINE_BREAK, alert.unit.unitCode.toString(), LINE_BREAK);
        outText.push(alert.timestamp.toLocaleString(DateTime.DATETIME_SHORT), LINE_BREAK);

        outText.push(LINE_BREAK, "<a href='", PAGERBUDDY_URL, "'>PagerBuddy</a>");

        const message = outText.join("");
        if (msgText == message) {
            //Do not bother with update - text has not changed
            return { awaitableResult: Promise.resolve(new TelegramSendResult(true, false, msgId)), cancellationToken: new AbortController(), messageText: message };
        }

        const cancellationToken = new AbortController();
        let queueResult;
        if (msgId != 0) {
            //We have an update
            queueResult = this.outputQueue.add(async () => {
                return await this.sendMessage(chatId, message);
            }, { priority: TelegramConnector.PRIORITY_ALERT, signal: cancellationToken.signal });
        } else {
            queueResult = this.outputQueue.add(async () => {
                return await this.sendMessage(chatId, message);
            }, { priority: TelegramConnector.PRIORITY_ALERT, signal: cancellationToken.signal });
        }

        return { awaitableResult: queueResult, cancellationToken: cancellationToken, messageText: message };
    }

    public async sendText(chatId: number, message: string): Promise<TelegramSendResult> {
        return await this.outputQueue.add(async () => {
            return await this.sendMessage(chatId, message);
        }, { priority: TelegramConnector.PRIORITY_STANDARD });
    }

    public sendResponseInterface(
        alertId: number,
        chatId: number,
        responses: UserResponse[],
        responseConfiguration: ResponseConfiguration,
        msgId: number = 0,
        msgText: string = ""): { awaitableResult: Promise<TelegramSendResult>, cancellationToken: AbortController, messageText: string } {

        const message = this.getResponseInterfaceMessage(responses);

        //We have to ensure the message text has changed, as we cannot edit a message with no changes
        if (message == msgText) {
            return { awaitableResult: Promise.resolve(new TelegramSendResult(true, false, msgId)), cancellationToken: new AbortController(), messageText: msgText };
        }

        const keyboard = this.getResponseInterfaceKeyboard(alertId, responseConfiguration);
        let opts: TelegramBot.SendMessageOptions | TelegramBot.EditMessageTextOptions = {
            reply_markup: {
                inline_keyboard: keyboard
            },
            chat_id: chatId
        }

        const controller = new AbortController();
        let queueTask;

        if (msgId != 0) {
            opts.message_id = msgId;
            queueTask = this.outputQueue.add(async () => {
                return await this.sendMessageEdit(chatId, message, opts as TelegramBot.EditMessageTextOptions);
            }, { priority: TelegramConnector.PRIORITY_STANDARD, signal: controller.signal });
        } else {
            queueTask = this.outputQueue.add(async () => {
                return await this.sendMessage(chatId, message, opts);
            }, { priority: TelegramConnector.PRIORITY_ALERT, signal: controller.signal });
        }

        return { awaitableResult: queueTask, cancellationToken: controller, messageText: message };
    }

    private getResponseInterfaceMessage(responses: UserResponse[]): string {
        let outText: string[] = [];

        const confirmResponses = UserResponse.sortByEstimatedArrival(UserResponse.getResponsesForType(responses, RESPONSE_TYPE.CONFIRM));
        const delayResponses = UserResponse.sortByEstimatedArrival(UserResponse.getResponsesForType(responses, RESPONSE_TYPE.DELAY));
        const denyResponses = UserResponse.sortByEstimatedArrival(UserResponse.getResponsesForType(responses, RESPONSE_TYPE.DENY));

        outText.push(BOLD_START, "Rückmeldungen", BOLD_END, LINE_BREAK, LINE_BREAK);
        outText.push(BOLD_START, `Zusagen (${confirmResponses.length} + ${delayResponses.length})`, BOLD_END, LINE_BREAK);
        confirmResponses.forEach(response => {
            outText.push(`${response.user.getPrintName()} [ETA: ${response.getEstimatedArrival().toLocaleString(DateTime.TIME_SIMPLE)}]`, LINE_BREAK);
        });
        delayResponses.forEach(response => {
            outText.push(`${response.user.getPrintName()}`, LINE_BREAK);
        })

        outText.push(BOLD_START, `Absagen (${denyResponses.length})`, BOLD_END, LINE_BREAK);
        denyResponses.forEach(response => {
            outText.push(`${response.user.getPrintName()}`, LINE_BREAK);
        });

        return outText.join("");
    }

    private getResponseInterfaceKeyboard(alertId: number, responseConfiguration: ResponseConfiguration): { text: string, callback_data: string }[][] {
        const options = responseConfiguration.getSortedResponseOptions();

        const inlineKeyboard: { text: string, callback_data: string }[][] = [];
        let keyboardLine: { text: string, callback_data: string }[] = [];

        options.forEach(option => {
            const item = {
                text: option.label,
                callback_data: `reply#${alertId.toString()}#%${option.id.toString()}%`
            }
            keyboardLine.push(item);

            if (keyboardLine.length > 2) {
                inlineKeyboard.push(keyboardLine);
                keyboardLine = [];
            }
        });

        return inlineKeyboard;
    }

    /**
     * Send a message with options (e.g. an inline keyboard) to a chat.
     * @param {number} chatId ID of the chat that the message will be sent to.
     * @param {string} message Text content to send.
     * @param {TelegramBot.SendMessageOptions} opts Message options (keyboards, etc.).
     * @return {Promise<bot_response>}
     */
    private async sendMessage(chatId: number, message: string, opts: TelegramBot.SendMessageOptions = {}): Promise<TelegramSendResult> {

        if (!message || message.length < 1) {
            //We cannot send empty message
            this.log.warn("Attempted to send an empty message. Will remove unsent message from queue.");
            return new TelegramSendResult(false);
        } else if (!chatId || chatId == 0) {
            //We need a valid chat id
            this.log.warn("Attempted to send a message to an empty chat id. Will remove unsent message from queue.");
            return new TelegramSendResult(false);
        }

        //Always enfore these options
        opts.parse_mode = 'HTML';
        opts.disable_web_page_preview = true;

        let sentMessage: TelegramBot.Message;
        try {
            sentMessage = await this.telegramBot.sendMessage(chatId, message, opts);
        } catch (error: any) {
            return this.botErrorSend(error, chatId);
        }

        this.reportStatus(true);
        return new TelegramSendResult(true, false, sentMessage.message_id);
    }

    /**
     * Edit an existing message.
     * @param {number} chatId
     * @param {string} message The new message text.
     * @param {TelegramBot.EditMessageTextOptions} opts The message options. Must contain reference to previous message to edit.
     * @returns {Promise<TelegramSendResult>} If sending the message was successfull.
     */
    private async sendMessageEdit(chatId: number, message: string, opts: TelegramBot.EditMessageTextOptions): Promise<TelegramSendResult> {
        let msgID = 0;

        //Always enfore these options
        opts.parse_mode = 'HTML';
        opts.disable_web_page_preview = true;

        try {
            //boolean is only returned for inline messages
            const res = await this.telegramBot.editMessageText(message, opts) as TelegramBot.Message;
            msgID = res.message_id;
        } catch (err: any) {
            if (isTelegramErrorTelegram(err) && err.response.body.error_code == 400) {
                //Message has probably gone away
                this.log.debug("Could not send message edit. Message was probably deleted");
                //TODO: Perhaps test this in the future and probe a more precise error
                return new TelegramSendResult(false);
            } else {
                this.log.error("Error trying to edit message.");
                return this.botErrorSend(err, chatId);
            }
        }
        this.reportStatus(true);
        return new TelegramSendResult(true, false, msgID);
    }

    private async pinMessage(chatId: number, messageId: number): Promise<boolean> {
        try {
            const me = await this.telegramBot.getMe();
            const meChatMember = await this.telegramBot.getChatMember(chatId, me.id.toString());
            if (meChatMember?.can_pin_messages) {
                //https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1pin_chat_message.html
                this.telegramBot.pinChatMessage(chatId, messageId);
            }
        } catch (error: any) {
            let err = error;
            if (isTelegramErrorTelegram(error)) {
                err = error.message;
            }
            this.log.warn("Bot could not pin a message. Error: " + err);
            return false;
        }
        this.reportStatus(true);
        return true;
    }

    private async unpinMessage(chatId: number, messageId: number): Promise<boolean> {
        try {
            let me = await this.telegramBot.getMe();
            let meChatMember = await this.telegramBot.getChatMember(chatId, me.id.toString());
            if (meChatMember?.can_pin_messages) {
                await this.telegramBot.unpinChatMessage(chatId, messageId);
            }
        } catch (error: any) {
            let err = error;
            if (isTelegramErrorTelegram(error)) {
                err = error.message;
            }
            this.log.warn("Bot could not unpin a message. Error: " + err);
            return false;
        }
        this.reportStatus(true);
        return true;
    }

    private handleCallback(query: TelegramBot.CallbackQuery) {
        if (!query.data || !query.message) {
            return;
        }

        //Handle user replies to alert - this is unfortunately a bit of a guessing game when parsing users.
        const matchReply = query.data.match(/^reply#(?<alertId>[0-9]+)#%(?<replyId>[0-9]+)%/);
        if (matchReply && matchReply.groups?.alertId && matchReply.groups.replyId) {
            const alertId = parseInt(matchReply.groups.alertId);
            const replyId = parseInt(matchReply.groups.replyId);

            const replyChatId = query.message.chat.id;
            const altName = query.from.first_name + (query.from.last_name ? " " + query.from.last_name : "");
            const replyUser = query.from.username ?? altName;

            const timestamp = DateTime.now();

            TelegramSink.responseCallback(alertId, replyId, replyUser, replyChatId, timestamp);
        }
    }

    private reportStatus(successfullRequest: boolean): void {
        if (successfullRequest) {
            this.errorStatusSince = DateTime.invalid("Placeholder");
        } else if (!this.errorStatusSince.isValid) {
            this.errorStatusSince = DateTime.now();
        }
    }

    private pauseQueue(period: number): void {
        this.outputQueue.pause();
        setTimeout(() => {
            this.outputQueue.start();
        }, period * 1000);
    }

    private botErrorOperation(error: Error): void {
        this.botErrorSend(error, 0);
    }

    /** Handle bot errors that occur on message send
     * @param {Error} error The error message.
     * @param {number} chatId
     * @returns {TelegramSendResult} If a sent message should be requeued etc.
     */
    private botErrorSend(error: Error, chatId: number): TelegramSendResult {
        //TODO: (ONGOING) Add handlers and strategies for occuring errors

        let resend = true;

        if (isTelegramErrorTelegram(error)) {
            switch (error.response.body.error_code) {
                case 400:
                    //The request is malformed. Log this and remove request from list
                    if (error.response.body.parameters?.migrate_to_chat_id) {
                        //Chat ID is obsolete - update with new ID
                        const newId = error.response.body.parameters.migrate_to_chat_id;
                        this.log.error("Could not send message. Chat migrated to new ID. Will update database with new chat id for future requests.");
                        TelegramSink.migrateChatId(chatId, newId);
                    } else {
                        this.log.error("Malformed telegram request. Removing unsent message. This is probably an implementation fault! Error: " + error.message);
                    }
                    resend = false;
                    break;
                case 403:
                    //Forbidden
                    //We have been blacklisted/removed from chat.
                    this.log.warn("Telegram sent us a forbidden error. Probably the bot was blocked by the user. Removing unsent message from queue. Error: " + error.message);
                    resend = false;
                    break;
                case 420:
                case 429:
                    //Flood
                    //Halt the queue and wait specified time before next call.
                    const retryDelay = error.response.body.parameters?.retry_after ?? 10; //Default to 10s
                    this.pauseQueue(retryDelay);
                    this.log.warn(`Telegram sent us a flood error. We have to wait ${retryDelay}s before the next request. Error: ` + error.message);
                    break;
                case 500:
                case 502:
                    //Telegram server error
                    this.pauseQueue(10); //Pause queue before next retry attempt.
                    this.log.debug("Telegram has an internal server error. We will have to wait for the problem to be fixed. Error: " + error.message);
                    this.reportStatus(false);
                    break;
                default:
                    this.log.error("Unexpected error from Telegram: " + error);
            }
        } else if (isTelegramErrorFatal(error)) {
            this.pauseQueue(10); //Pause queue before next retry attempt.
            this.log.error("Fatal error in telegram bot: " + error);
            this.reportStatus(false);
        } else if (isTelegramErrorParse(error)) {
            this.pauseQueue(10); //Pause queue before next retry attempt.
            this.log.error("Parse error in telegram bot: " + error);
            this.reportStatus(false);
        } else {
            this.log.error("An unkown error occurred in telegram bot: " + error);
        }
        return new TelegramSendResult(false, resend, 0);
    }


    /**
    * Cleanly empty queue and stop bot.
    */
    public async stop() {
        this.outputQueue.pause();
        this.outputQueue.clear();

        await this.telegramBot.stopPolling({cancel: true});

        try {
            await this.telegramBot.close();
        } catch (error : any) {
            if (error?.response?.statusCode == 429) {
                //This is a standard flood error if bot is closed within 10min of opening - ignore
            } else {
                this.log.warn("Error stopping bot: " + error.message);
            }
        }
    }
}

class TelegramSendResult {

    public success: boolean;
    public retry: boolean;
    public messageId: number;

    public constructor(success: boolean = true, retry: boolean = false, messageId: number = 0) {
        this.success = success;
        this.retry = retry;
        this.messageId = messageId;
    }
}

//Created from info at https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md and experience

type TelegramErrorFatal = {
    code: "EFATAL"
}
function isTelegramErrorFatal(a: any): a is TelegramErrorFatal {
    return a?.code == "EFATAL";
}

type TelegramErrorParse = {
    code: "EPARSE",
    response: http.IncomingMessage & { body: string }
}
function isTelegramErrorParse(a: any): a is TelegramErrorParse {
    return a?.code == "EPARSE";
}

type TelegramErrorTelegram = {
    code: "ETELEGRAM",
    response: http.IncomingMessage & {
        body: {
            ok: boolean,
            error_code: number,
            description: string,
            parameters?: {
                migrate_to_chat_id?: number,
                retry_after?: number
            }
        },
        request?: {
            body: string
        }
    },
    message: string,
}
function isTelegramErrorTelegram(a: any): a is TelegramErrorTelegram {
    return a?.code == "ETELEGRAM";
}