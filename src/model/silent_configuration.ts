import { Entity, ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity, TableInheritance } from "typeorm";
import {DateTime, DayNumbers, Interval, WeekdayNumbers} from "luxon";

/**
 * A definition of when an alert should be handled as a regular message instead of an 
 * urgent alert (typcially for test alerts). This is a specific property of a unit.
 */

//Inheritance in TypeORM: https://orkhan.gitbook.io/typeorm/docs/entity-inheritance
@Entity()
@TableInheritance({ column: { type: "varchar", name: "type" } })
export default abstract class SilentConfiguration extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    description: string;

    constructor(description:string = ""){
        super();
        this.description = description;
    }

    /**
     * Check if a timestamp fulfills the conditions of the silent configuration.
     * Depending on the silent configuration type this may check nothing,
     * the time of day or the full timestamp.
     * @param timestamp 
     */
    abstract isInSilentPeriod(timestamp: DateTime): boolean;

}

@ChildEntity()
export class SilentNever extends SilentConfiguration{
    constructor(description: string = ""){
        super(description);
    }

    isInSilentPeriod(timestamp: DateTime): boolean {
        return false;
    }

}

@ChildEntity()
export class SilentAlways extends SilentConfiguration{
    constructor(description: string = ""){
        super(description);
    }

    isInSilentPeriod(timestamp: DateTime): boolean {
        return true;
    }
}

@ChildEntity()
export class SilentTime extends SilentConfiguration{

    //Both start and end times are to be interpreted as time of day without a relevance to date
    //If end time is before start time, interpret as silent time through the night.
    @Column()
    startTime: DateTime;

    @Column()
    endTime: DateTime;

    constructor(description: string = "", startTime: DateTime = DateTime.fromMillis(0), endTime: DateTime = DateTime.fromMillis(0)){
        super(description);

        this.startTime = startTime;
        this.endTime = endTime;
    }

    public static get default() : SilentTime{
        return new SilentTime();
    }

    /**
     * We frequently have to compare times. To enable the use of date libraries, this
     * helper removes anything but the time of day from a Date.
     * @param timestamp 
     */
    static stripDateToTime(timestamp: DateTime): DateTime {
        return DateTime.fromObject({hour: timestamp.hour, minute: timestamp.minute, second: timestamp.second});
    }

    isInSilentPeriod(timestamp: DateTime): boolean {

        const startTimeOfDay = SilentTime.stripDateToTime(this.startTime);
        const endTimeofDay = SilentTime.stripDateToTime(this.endTime);
        const timestampTimeOfDay = SilentTime.stripDateToTime(timestamp);

        let checkInterval = Interval.fromDateTimes(startTimeOfDay, endTimeofDay);
        const inInterval = checkInterval.contains(timestampTimeOfDay);
        const flipTime = startTimeOfDay > endTimeofDay;

        return inInterval == flipTime;
    }
}

@ChildEntity()
export class SilentDayOfWeek extends SilentConfiguration{

    @Column()
    day: WeekdayNumbers;

    @Column()
    time: SilentTime;

    constructor(description: string = "", day: WeekdayNumbers = 1, time: SilentTime = SilentTime.default){
        super(description);

        this.day = day;
        this.time = time;
    }

    isInSilentPeriod(timestamp: DateTime): boolean {
        const dayMatch = timestamp.weekday == this.day;
        const timeMatch = this.time.isInSilentPeriod(timestamp);

        return dayMatch && timeMatch;
    }
}

@ChildEntity()
export class SilentDayOfMonth extends SilentConfiguration{

    @Column()
    day: DayNumbers;

    @Column()
    time: SilentTime;

    constructor(description: string = "", day: DayNumbers = 1, time: SilentTime = SilentTime.default){
        super(description);

        this.day = day;
        this.time = time;
    }

    isInSilentPeriod(timestamp: DateTime): boolean {  
        const dayMatch = timestamp.daysInMonth == this.day;
        const timeMatch = this.time.isInSilentPeriod(timestamp);

        return dayMatch && timeMatch;
    }
}