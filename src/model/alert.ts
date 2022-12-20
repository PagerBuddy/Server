import { DateTime } from "luxon";
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, ManyToMany, JoinTable } from "typeorm";
import AlertSource from "./sources/alert_source.js";
import AlertSourceManual from "./sources/alert_source_manual.js";
import Unit from "./unit.js";

export enum INFORMATION_CONTENT {NONE, ID, KEYWORD, COMPLETE};

@Entity()
export default class Alert extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    readonly timestamp: DateTime;

    @Column()
    keyword: string; 

    @Column()
    message: string;

    @Column()
    location: string;

    @Column()
    informationContent: INFORMATION_CONTENT;

    @Column()
    @ManyToOne(() => Unit, {eager: true, onDelete: "CASCADE"})
    readonly unit: Unit;

    @Column()
    @ManyToMany(() => AlertSource, {eager: true})
    @JoinTable()
    sources: AlertSource[];

    private updateCallbacks: ((update: Alert) => void)[] = [];

    public constructor(
        unit: Unit = Unit.default, 
        timestamp: DateTime = DateTime.fromMillis(0), 
        informationContent: INFORMATION_CONTENT = INFORMATION_CONTENT.NONE,  
        keyword: string = "", 
        message: string = "", 
        location: string = "", 
        sources: AlertSource[] = []){
            super();
            this.unit = unit;
            this.timestamp = timestamp;
            this.informationContent = informationContent;
            this.keyword = keyword;
            this.message = message;
            this.location = location;
            this.sources = sources;
    }

    public static get default(){
        return new Alert();
    }

    get isSilentAlert(): boolean {
        return this.unit.isSilentTime(this.timestamp);
    }

    get isManualAlert(): boolean {
        return this.sources.length == 1 && this.sources.some((src) => src instanceof AlertSourceManual);
    }

    /**
     * Multiple sources may emit multiple events with different information content for the same alert.
     * These must be merged into one alert. Merging criteria are source specific and will be decided there.
     * @param update 
     */
    public alertUpdate(update: Alert) : void{
        //Update list of sources that emitted this alert
        update.sources.forEach(newSource => {
            if(!this.sources.some((source) => source.id == newSource.id)){
                this.sources.push(newSource);
            }
        });

        //Only update if better information
        if(update.informationContent > this.informationContent){
            this.keyword = update.keyword;
            this.message = update.message;
            this.location = update.location;

            this.updateCallbacks.forEach(callback => {
                callback(this);
            });
        }
    }

    public registerUpdateCallback(callback: (update: Alert) => void){
        this.updateCallbacks.push(callback);
    }

    public getLocalisedCopy(timeZone: string, locale: string) : Alert {
        const localisedAlert = new Alert(
            this.unit, 
            this.timestamp.setZone(timeZone).setLocale(locale),
            this.informationContent,
            this.keyword,
            this.message,
            this.location,
            this.sources);
        
        return localisedAlert;
    }

    /**
     * Produce a consise JSON object, describing the importent elements of this alert.
     * This is most prominently used in FCM for app notification.
     */
    public getSerialisableAlert() : SerialisableAlert{
        const jsonAlert = {
            timestamp: this.timestamp.toMillis(),
            keyword: this.keyword,
            message: this.message,
            location: this.location,
            informationContent: this.informationContent.toString(),
            silentAlert: this.isSilentAlert,
            manualAlert: this.isManualAlert,
            id: this.id,
            unit: {
                name: this.unit.name,
                shortName: this.unit.shortName,
                code: this.unit.unitCode
            }
        };

        return jsonAlert;
    }
}

export type SerialisableAlert = {
    timestamp: number,
    keyword: string,
    message: string,
    location: string,
    informationContent: string,
    silentAlert: boolean,
    manualAlert: boolean,
    id: number,
    unit: {
        name: string,
        shortName: string,
        code: number
    }
};