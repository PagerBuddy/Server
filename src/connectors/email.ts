import nodemailer from "nodemailer";
import SMTPConnection from "nodemailer/lib/smtp-connection/index.js";
import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import Log from "../log.js";
import SystemConfiguration from "../model/system_configuration.js";

export default class EMailConnector{

    //TODO: Add pretty email formats

    private static instance: EMailConnector;

    private log = Log.getLogger(EMailConnector.name);

    private transport;
    private fromAddress : string;

    private constructor(smtpOptions: SMTPTransport.Options, fromAddress: string){
        this.transport = nodemailer.createTransport(smtpOptions)
        this.transport.verify((error, success) => {
            if(error){
                this.log.error("Could not initialise E-Mail connector.");
                this.log.error(error);
            }
        });
        this.fromAddress = fromAddress;
    }

    public static getInstance() : EMailConnector | null{
        if(!SystemConfiguration.eMailEnable){
            return null;
        }
        if(!EMailConnector.instance){
            const connector = new EMailConnector(SystemConfiguration.eMailConfiguration, SystemConfiguration.eMailSender);
            EMailConnector.instance = connector;
        }
        return EMailConnector.instance;
    }

    public sendMessage(text: string, subjectKeyword: string, recipients: string[]){
        const mailOptions = {
            from: this.fromAddress,
            to: recipients.join(", "),
            subject: `PagerBuddy: ${subjectKeyword}`,
            text: text
        }

        this.transport.sendMail(mailOptions, (error, info) => {
            if(error){
                this.log.warn("Error sending E-Mail.");
                this.log.warn(error);
            }
        });
    }


}