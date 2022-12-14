import { DateTime, Duration } from "luxon";
import Unit from "../unit";

const KATSYS_SCHLEIFEN_TIME_FORMAT = "HH:mm";

export default class KatSysSchleife {

    private alertRegion: string;
    public unitId: number;
    public alertTimestamp: DateTime;

    constructor(schleifeDescription: string, katSysTimestamp: DateTime) {

        const trimmedSchleife = schleifeDescription.trim();

        if (trimmedSchleife.split(" ").length > 3) {
            throw new Error(`Too many parameters for Schleife provided: ${schleifeDescription}`)
        }

        const [group, zvei, alertTime] = trimmedSchleife.split(" ");
        if (zvei.length < 4 || zvei.length > 5) {
            //This occurs frequently and should go away silently
            throw new Error(`Invalid ZVEI: ${zvei}`);
        }
        if (zvei.length == 4) {
            this.unitId = parseInt(`2${zvei}`);
        }
        else {
            this.unitId = parseInt(zvei);
        }

        this.alertRegion = group;
        this.alertTimestamp = this.guessAlertTimestamp(alertTime, katSysTimestamp);
    }


    public matchRegion(decodeRegions: string[]){
        return decodeRegions.includes(this.alertRegion);
    }

    private guessAlertTimestamp(alertTime: string, katSysTimestamp: DateTime) : DateTime {
        //KatSys pings do not have a timestamp, we have to make one in KatSys time ourselfs

        //We have to manually check if time is accurate, as it may be a changed alert with wrong time
        if (katSysTimestamp.diffNow() > Duration.fromObject({minutes: 2})) {
            //Timestamp is older than two minutes, check if alternative timestamp fits

            const refStamp = DateTime.now().setZone(katSysTimestamp.zone).startOf("day");
            const schleifenTime = Duration.fromISOTime(alertTime);

            const schleifenTimestamp = refStamp.plus(schleifenTime);
            
            if (schleifenTimestamp.diffNow() < Duration.fromObject({minutes: 2})) {
                //Alternative timestamp is within two minutes of now time - use schleifen time
                return schleifenTimestamp;
            }
        }
        return katSysTimestamp;
    }
}