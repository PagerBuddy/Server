import express, { Application, Express } from "express";
import AppSink from "../model/sinks/app_sink.js";
import User from "../model/user.js";
import FirebaseConnector from "./firebase.js";
import Unit, { SerialisableUnit, UnitSubscription } from "../model/unit.js";


const PORT = 0;

export default class WebAPI{

    private static instance: WebAPI;

    private app: Express;

    private constructor(){
        this.app = express();
        this.setupRoutes(this.app);
        this.app.listen(PORT, () => {
            //callback start listening
        });
        
    }

    public stop() : void{
        this.app.removeAllListeners();
    }

    private async getRequestUser(token: string): Promise<User|null>{
        const user = FirebaseConnector.verifyUserToken(token);
        return user;
    }

    private async userAppAuthenticate(user: User, reqBody: APIAppAuthenticationBody): Promise<boolean>{
        const appSink = user.sinks?.find(sink => {
            return sink instanceof AppSink && sink.deviceID == reqBody.deviceID;
        }) as AppSink;

        if(appSink){
            appSink.deviceToken = reqBody.deviceToken;
            appSink.locale = reqBody.locale;
            appSink.timeZone = reqBody.timeZone;
            appSink.save();
        }else{
            if(!user.sinks){
                user.sinks = []; //init if necessary
            }
            const newSink = AppSink.create({
                active: true,
                subscriptions: [],
                deviceToken: reqBody.deviceToken,
                deviceID: reqBody.deviceID,
                locale: reqBody.locale,
                timeZone: reqBody.timeZone
            });
            newSink.save();
            user.sinks.push(newSink);
            user.save();
        }
        return true;
    }

    private async updateSubscriptions(user: User, reqBody: APIAppSubscriptionBody): Promise<boolean>{
        const appSink = user.sinks?.find(sink => {
            return sink instanceof AppSink && sink.deviceID == reqBody.deviceID;
        }) as AppSink;

        if(appSink){
            const allowedUnits = await user.getAvailableUnits();
            const allowedUnitCodes = allowedUnits.map((unit) => unit.unitCode);

            if(!appSink.subscriptions){
                appSink.subscriptions = [];
            }

            reqBody.subscriptions.forEach(async subscription => {
                if(!allowedUnitCodes.includes(subscription.unitCode)){
                    //illegal request
                    return false;
                }else{
                    const oldSub = appSink.subscriptions?.find((sub) => sub.unit?.unitCode == subscription.unitCode);
                    if(oldSub){
                        oldSub.active = subscription.active;
                        oldSub.save();
                    }else{
                        const newSub = UnitSubscription.create({
                            unit: await Unit.fromUnitCode(subscription.unitCode),
                            active: subscription.active
                        });
                        newSub.save();
                        appSink.subscriptions?.push(newSub);
                    }
                }
            });

            appSink.save();
            return true;
        }else{
            return false;
        }
    }

    private setupRoutes(app: Express): void{
        app.get("/app/authenticate", async (req, res) => {
            let result = false;
            if(isAPIAppAuthenticationBody(req.body)){
                const user = await this.getRequestUser(req.body.jwt);
                if(user){
                    result = await this.userAppAuthenticate(user, req.body);
                }
            }
            res.send({success: result});
        });
        app.get("/app/available_units", async (req, res) => {
            if(isAPIAppAuthenticationBody(req.body)){
                const user = await this.getRequestUser(req.body.jwt);
                if(user){
                    const units = await user.getAvailableUnits();
                    const serialisableUnits : SerialisableUnit[] = [];
                    units.forEach(unit => {
                        serialisableUnits.push(unit.getSerialisableUnit());
                    });

                    res.send({success: true, units: serialisableUnits})
                    return;
                }
            }
            res.send({success: false});

        });
        app.get("/app/set_subscriptions", async (req, res) => {
            if(isAPIAppSubscriptionBody(req.body)){
                const user = await this.getRequestUser(req.body.jwt);
                if(user){
                    const result = await this.updateSubscriptions(user, req.body);
                    res.send({success: result});
                    return;
                }
            }
            res.send({success: false});
        });
    }

    

    public static getInstance(): WebAPI{
        if(!WebAPI.instance){
            const webApi = new WebAPI();
            WebAPI.instance = webApi;
        }
        return WebAPI.instance;
    }

}

type APIAppAuthenticationBody = {
    jwt: string,
    deviceToken: string,
    deviceID: string,
    timeZone: string,
    locale: string
}
function isAPIAppAuthenticationBody(a: any): a is APIAppAuthenticationBody{
    if(a?.jwt){
        return true;
    }
    return false;
}

type APIAppSubscriptionBody = APIAppAuthenticationBody & {
    subscriptions: APIAppUnitSubscription[]
}
function isAPIAppSubscriptionBody(a: any): a is APIAppSubscriptionBody{
    if(a?.subscriptions && a?.jwt){
        return true;
    }
    return false;
}

type APIAppUnitSubscription = {
    unitCode: number,
    active: boolean
}