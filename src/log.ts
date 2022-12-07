import winston from "winston";
import TelegramTransport from "./connectors/telegram_transport";

export default class Log {

    private static instance: Log;

    private logLevel = "silly";
    private telegramTargetChatIds: number[] = []; 

    private constructor(){
        //TODO: get config
    }

    public static getInstance(){
        if(!Log.instance){
            Log.instance = new Log();
        }
        return Log.instance;
    }

    private static CONSOLE_FORMAT = winston.format.combine(
        winston.format.colorize({ all: true }),
        // winston.format.label({label: "PagerBuddy"}),
        winston.format.timestamp({ format: "DD.MM.YYYY HH:mm:ss" }),
        winston.format.splat(),
        // winston.format.align(),
        winston.format.printf((info) => `${info.timestamp} [${info.label}] ${info.level}: ${info.message} `)
    );

    private static TELEGRAM_FORMAT = winston.format.combine(
        // winston.format.label({label: "PagerBuddy"}),
        winston.format.timestamp({ format: "DD-HH:mm:ss" }),
        winston.format.splat(),
        // winston.format.align(),
        winston.format.printf((info) => `${info.timestamp} | [${info.label}] ${info.level}: ${info.message} `)
    );

    public static getLogger(label: string) : winston.Logger {
        return Log.getInstance().getLogger(label);
    }

    public getLogger(label: string) : winston.Logger{
        const loggerName = `${label.toLowerCase()}Logger`;
        
        //TODO: get/config chat ID recipients


        winston.loggers.add(loggerName, {
            level: this.logLevel,
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.label({ label: label }), Log.CONSOLE_FORMAT),
                    stderrLevels: ['error', 'warn']
                }),
                new TelegramTransport({
                    format: winston.format.combine(winston.format.label({ label: label }), Log.TELEGRAM_FORMAT)
                }, this.telegramTargetChatIds)
            ]
        });
        return winston.loggers.get(loggerName)
    }
}