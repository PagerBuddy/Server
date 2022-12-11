import Alert from "./model/alert";
import Group from "./model/group";


export default class AlertRouter{
    private static instance : AlertRouter;

    public static getInstance() : AlertRouter{
        if(!AlertRouter.instance){
            AlertRouter.instance = new AlertRouter();
        }
        return AlertRouter.instance;
    }

    //Alerts are received from alert sources and emitted
    //They then have to be passed to all groups - the rest is handled there

    public async handleAlert(alert: Alert){
        //TODO: Detect and filter double alerts here (forward  if information update only)

        const groupList = await Group.find();
        groupList.forEach((group) => {
            group.handleAlert(alert);
        })
    }
}