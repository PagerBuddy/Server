import { Credentials } from "google-auth-library";
import { google } from "googleapis";
import Log from "../log.js";
import { SerialisableAlert } from "../model/alert.js";
import { request } from 'https';
import { IncomingMessage } from "http";
import { DateTime } from "luxon";
import SystemConfiguration from "../model/system_configuration.js";

export default class FirebaseConnector {

    private static instance: FirebaseConnector;
    private log = Log.getLogger(FirebaseConnector.name);

    private accessToken?: Credentials;

    private constructor(){}

    public static getInstance() : FirebaseConnector | undefined{
        if(!SystemConfiguration.firebaseEnabled){
            return undefined;
        }
        if (!FirebaseConnector.instance) {
            FirebaseConnector.instance = new FirebaseConnector();
        }
        return FirebaseConnector.instance;
    }

    public async sendAlert(
        deviceToken: string,
        alertPayload: SerialisableAlert,
        configuration: FirebaseAlertConfiguration,
        invalidTokenCallback: () => void): Promise<boolean> {
        await this.updateAccessToken();
        const message = this.getMessageJson(deviceToken, alertPayload, configuration);
        return this.sendFirebaseMessage(message, invalidTokenCallback);
    }

    private async sendFirebaseMessage(message: string, invalidTokenCallback: () => void): Promise<boolean> {
        const key = SystemConfiguration.firebaseCredentials;

        const options = {
            hostname: 'fcm.googleapis.com',
            path: '/v1/projects/' + key.project_id + '/messages:send',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.accessToken?.access_token
            }
        };

        return new Promise((resolve) => {
            const req = request(options, (result: IncomingMessage) => {
                result.setEncoding('utf8');
                result.on('data', (data: any) => {
                    let jsonResponse;
                    try {
                        jsonResponse = JSON.parse(data);
                    } catch (error) {
                        this.log.error("Error sending FCM message. Response too large to parse: " + data);
                        resolve(false);
                        return;
                    }
                    if (jsonResponse.error) {
                        if (jsonResponse.error.code == 404 && jsonResponse.error.status == "NOT_FOUND") {
                            //Device ID does not exist (any more) - delete it.
                            this.log.debug("FCM responded entity not found. Davice ID is invalid.");
                            invalidTokenCallback();
                        } else if (jsonResponse.error.code == 400 && jsonResponse.error.status == "INVALID_ARGUMENT") {
                            //This seems to occur for obsolete tokens
                            this.log.debug("FCM responded invalid (token) argument.");
                            invalidTokenCallback();
                        } else {
                            this.log.error("Error sending FCM message: " + data);
                        }
                        resolve(false);
                    } else {
                        this.log.silly('Message sent to Firebase for delivery, response:');
                        this.log.silly(data);
                        resolve(true);
                    }

                });
            });

            req.on('error', (error: Error) => {
                this.log.warn('Unable to send message to Firebase');
                this.log.warn(error);
                resolve(false);
            });

            req.write(message);
            req.end();
        });
    }

    private async updateAccessToken(): Promise<void> {
        //Refresh token if necessary
        const tokenValidTo = this.accessToken?.expiry_date ?? 0;
        if (!this.accessToken) {
            const token = await this.getAccessToken();
            if (isCredentials(token)) {
                this.accessToken = token;
            }
        }
    }

    /**
     * Get a short-lived access token from FCM server.
     * @returns {Promise<string|null|undefined|Error>} A promise that will resolve an access token on success.
     */
    private getAccessToken(): Promise<Error | Credentials | undefined> {

        const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
        const SCOPES = [MESSAGING_SCOPE];

        const key = SystemConfiguration.firebaseCredentials;
        const jwtClient = new google.auth.JWT(
            key.client_email,
            "",
            key.private_key,
            SCOPES,
            ""
        );

        return new Promise((resolve, reject) => {
            jwtClient.authorize((err: Error | null, result?: Credentials) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private getMessageJson(deviceToken: string, alertPayload: SerialisableAlert, configuration: FirebaseAlertConfiguration): string {

        const fcm_ttl = 15 * 60; //Remove alert after 15min, if not delivered

        const titleKey = alertPayload.silentAlert ? "TEST_ALERT_TITLE" : "ALERT_TITLE";
        const messageKey = alertPayload.silentAlert ? "TEST_ALERT_MESSAGE" : "ALERT_MESSAGE";
        const volume = alertPayload.silentAlert ? configuration.silentAlertVolume : configuration.alertVolume;

        const messageBody = alertPayload.unit.name;

        const timestamp = DateTime.fromMillis(alertPayload.timestamp, {zone: "utc"}).setZone(configuration.timeZone);
        const timeString = timestamp.toLocaleString(DateTime.TIME_SIMPLE, {locale: configuration.locale});

        //FCM only knows strings!
        let fcm = {
            message: {
                token: deviceToken,
                data: alertPayload,
                android: {
                    priority: "high",
                    ttl: fcm_ttl.toString() + "s"
                },
                apns: {
                    headers: {
                        "apns-priority": "10",
                        "apns-expiration": (Math.round(alertPayload.timestamp / 1000) + fcm_ttl).toString()
                    },
                    payload: {
                        aps: {
                            alert: {
                                "title-loc-key": titleKey,
                                "loc-key": messageKey,
                                "loc-args": [messageBody, timeString]
                            },
                            sound: {
                                critical: 1,
                                name: configuration.alertSound,
                                volume: volume
                            },
                            "interruption-level": "critical"
                        }
                    }
                }
            }
        }
        const json = JSON.stringify(fcm);
        return json;
    }

    /**
     * Sends a non-user-facing notification to the specified token to check if the token is (still) valid.
     */
    public async heartbeatProbe(checkToken: string, invalidTokenCallback: () => void): Promise<boolean> {
        await this.updateAccessToken();

        const message = {
            message: {
                token: checkToken,
                apns: {
                    headers: {
                        "apns-priority": "5"
                    }
                }
            }
        }

        const json = JSON.stringify(message);
        return await this.sendFirebaseMessage(json, invalidTokenCallback);
    }
}

export type FirebaseAlertConfiguration = {
    alertVolume: number,
    silentAlertVolume: number,
    alertSound: string,
    timeZone: string,
    locale: string
}

function isCredentials(a: any): a is Credentials {
    return a?.access_token ? true : false;
}

export type FirebaseCredentials = {
    type: string,
    project_id: string,
    private_key_id: string,
    private_key: string,
    client_email: string,
    client_id: string,
    auth_uri: string,
    token_uri: string,
    auth_provider_x509_cert_url: string,
    client_x509_cert_url: string
}