import { DateTime, Duration } from "luxon";
import { KatSysJsonAlert } from "../../connectors/katsys.js";
import Log from "../../log.js";
import KatSysSchleife from "./katsys_schleife.js";

const KATSYS_DATE_FORMAT = "dd.MM.yyyy";
const KATSYS_TIME_FORMAT = "HH:mm:ss"
//alarmdatum: '13.03.2022' //dd.MM.yyyy
//alarmuhrzeit: '08:15:14' //HH:mm:ss

export default class KatSysAlert {

    private log = Log.getLogger(KatSysAlert.name);

    public keyword : string;
    public location : string;
    private schleifen : KatSysSchleife[] = [];

    constructor(textElements : KatSysJsonAlert, katSysTimeZone : string) {
        const keyword = textElements.schlagwort;
        const location = textElements.einsatzort;
        const alertDate = textElements.alarmdatum;
        const alertTime = textElements.alarmuhrzeit;
        const schleifenDelta = textElements.schleifen_delta;

        this.keyword = keyword;
        this.location = location; //TODO: Possibly extend with road

        const timestampDate = DateTime.fromFormat(alertDate, KATSYS_DATE_FORMAT, {zone: katSysTimeZone});
        const timestampTime = DateTime.fromFormat(alertTime, KATSYS_TIME_FORMAT, {zone: katSysTimeZone});
        const timestamp = timestampDate.plus(timestampTime);

        //schleifen_delta may be empty - do not bother with extrusion then
        if(schleifenDelta.length > 0){
            const rawSchleifen = schleifenDelta.split('\n');
            rawSchleifen.forEach((rawSchleife) => {
                try {
                    const schleife = new KatSysSchleife(rawSchleife, timestamp);
                    this.schleifen.push(schleife);
                } catch (error) {
                    this.log.debug("Error generating alert item: " + error);
                }
            });
        }
    }

    public getRelevantSchleifen(decodeChannels : string[]) : KatSysSchleife[] {
        return this.schleifen.filter(schleife => {
            const correctRegion = schleife.matchRegion(decodeChannels);
            const current = schleife.alertTimestamp.diffNow() < Duration.fromObject({minutes: 2});

            return correctRegion && current;
        });
    }
}