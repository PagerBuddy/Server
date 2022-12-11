import winston from "winston";
import TelegramTransport from "./connectors/telegram_transport";
import SystemConfiguration from "./model/system_configuration";

export default class Log {

    private static instance: Log;

    private logLevel;
    private telegramTargets: TelegramLogTarget[];

    private constructor() {
        this.logLevel = SystemConfiguration.logLevel;
        this.telegramTargets = SystemConfiguration.telegramLogTargetIds;
    }

    public static getInstance() {
        if (!Log.instance) {
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

    public static getLogger(label: string): winston.Logger {
        return Log.getInstance().getLogger(label);
    }

    public getLogger(label: string): winston.Logger {
        const loggerName = `${label.toLowerCase()}Logger`;

        const transports = [];
        transports.push(
            new winston.transports.Console({
                format: winston.format.combine(winston.format.label({ label: label }), Log.CONSOLE_FORMAT),
                stderrLevels: ['error', 'warn']
            })
        );
        this.telegramTargets.forEach(target => {
            transports.push(
                new TelegramTransport({
                    format: winston.format.combine(winston.format.label({ label: label }), Log.TELEGRAM_FORMAT),
                    level: target.logLevel
                }, target.chatId)
            );
        });

        winston.loggers.add(loggerName, {
            level: this.logLevel,
            transports: transports
        });
        return winston.loggers.get(loggerName)
    }
}

export type TelegramLogTarget = {
    logLevel: string,
    chatId: number
}