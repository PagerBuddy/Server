import { Equal, MoreThan } from "typeorm";
import Alert from "./model/alert.js";
import Group from "./model/group.js";
import SystemConfiguration from "./model/system_configuration.js";


export default class AlertRouter{
    private static instance : AlertRouter;

    public static getInstance() : AlertRouter{
        if(!AlertRouter.instance){
            AlertRouter.instance = new AlertRouter();
        }
        return AlertRouter.instance;
    }

    private constructor(){}

    //Alerts are received from alert sources and emitted
    //They then have to be passed to all groups - the rest is handled there

    public async handleAlert(alert: Alert){

        const oldAlert = await Alert.findOne({
            where: {
                unit: Equal(alert.unit),
                timestamp: MoreThan(alert.timestamp.minus(SystemConfiguration.doubleAlertTimeout))
            }
        });

        if(oldAlert){
            //Alerts belong together
            oldAlert.alertUpdate(alert);
            await oldAlert.save();
        }else{
            //new Alert
            await alert.save();
            const groupList = await Group.find();
            groupList.forEach((group) => {
                group.handleAlert(alert);
            });
        }
    }
}