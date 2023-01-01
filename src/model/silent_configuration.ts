import { Entity, ChildEntity, PrimaryGeneratedColumn, Column, BaseEntity, TableInheritance, ManyToOne, Relation } from "typeorm";
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
    description: string = "";

    /**
     * Check if a timestamp fulfills the conditions of the silent configuration.
     * Depending on the silent configuration type this may check nothing,
     * the time of day or the full timestamp.
     * @param timestamp 
     */
    abstract isInSilentPeriod(timestamp: DateTime): boolean;

    public getSerialisableSilentConfiguration() : SerialisableSilentConfiguration{
        return {
            description: this.description,
            type: SilentConfiguration.name
        };
    }

}

@ChildEntity()
export class SilentNever extends SilentConfiguration{

    isInSilentPeriod(timestamp: DateTime): boolean {
        return false;
    }

    public getSerialisableSilentConfiguration() : SerialisableSilentConfiguration{
        const base = super.getSerialisableSilentConfiguration();
        base.type = SilentNever.name;
        return base;
    }

}

@ChildEntity()
export class SilentAlways extends SilentConfiguration{

    isInSilentPeriod(timestamp: DateTime): boolean {
        return true;
    }

    public getSerialisableSilentConfiguration() : SerialisableSilentConfiguration{
        const base = super.getSerialisableSilentConfiguration();
        base.type = SilentAlways.name;
        return base;
    }
}

@ChildEntity()
export class SilentTime extends SilentConfiguration{

    //Both start and end times are to be interpreted as time of day without a relevance to date
    //If end time is before start time, interpret as silent time through the night.
    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return DateTime.fromMillis(value);
            },
            to(value : DateTime) {
                return value.toMillis();
            },
        }
    })
    public startTime: DateTime = DateTime.fromMillis(0);

    @Column({
        type: "bigint",
        transformer: {
            from(value : number) {
                return DateTime.fromMillis(value);
            },
            to(value : DateTime) {
                return value.toMillis();
            },
        }
    })
    public endTime: DateTime = DateTime.fromMillis(0);

    public static get default() : SilentTime{
        return SilentTime.create();
    }

    /**
     * We frequently have to compare times. To enable the use of date libraries, this
     * helper removes anything but the time of day from a Date.
     * @param timestamp 
     */
    public static stripDateToTime(timestamp: DateTime): DateTime {
        return DateTime.fromObject({hour: timestamp.hour, minute: timestamp.minute, second: timestamp.second});
    }

    public isInSilentPeriod(timestamp: DateTime): boolean {

        const startTimeOfDay = SilentTime.stripDateToTime(this.startTime);
        const endTimeofDay = SilentTime.stripDateToTime(this.endTime);
        const timestampTimeOfDay = SilentTime.stripDateToTime(timestamp);

        let checkInterval = Interval.fromDateTimes(startTimeOfDay, endTimeofDay);
        const inInterval = checkInterval.contains(timestampTimeOfDay);
        const flipTime = startTimeOfDay > endTimeofDay;

        return inInterval == flipTime;
    }

    public getSerialisableSilentConfiguration() : SerialisableSilentConfiguration{
        const base = super.getSerialisableSilentConfiguration();
        base.type = SilentTime.name;
        base.startTimeMillis = this.startTime.toMillis();
        base.endTimeMillis = this.endTime.toMillis();
        return base;
    }
}

@ChildEntity()
export class SilentDayOfWeek extends SilentConfiguration{

    @Column()
    day: WeekdayNumbers = 1;

    @ManyToOne(() => SilentTime, {eager: true, onDelete: "RESTRICT"})
    time: Relation<SilentTime> = SilentTime.default;

    public isInSilentPeriod(timestamp: DateTime): boolean {
        const dayMatch = timestamp.weekday == this.day;
        const timeMatch = this.time.isInSilentPeriod(timestamp);

        return dayMatch && timeMatch;
    }

    public getSerialisableSilentConfiguration() : SerialisableSilentConfiguration{
        const base = super.getSerialisableSilentConfiguration();
        base.type = SilentDayOfWeek.name;
        base.dayOfWeek = this.day;
        base.startTimeMillis = this.time.startTime.toMillis();
        base.endTimeMillis = this.time.endTime.toMillis();
        return base;
    }
}

@ChildEntity()
export class SilentDayOfMonth extends SilentConfiguration{

    @Column()
    day: DayNumbers = 1;

    @ManyToOne(() => SilentTime, {eager: true, onDelete: "RESTRICT"})
    time: Relation<SilentTime> = SilentTime.default;

    isInSilentPeriod(timestamp: DateTime): boolean {  
        const dayMatch = timestamp.daysInMonth == this.day;
        const timeMatch = this.time.isInSilentPeriod(timestamp);

        return dayMatch && timeMatch;
    }

    public getSerialisableSilentConfiguration() : SerialisableSilentConfiguration{
        const base = super.getSerialisableSilentConfiguration();
        base.type = SilentDayOfMonth.name;
        base.dayOfMonth = this.day;
        base.startTimeMillis = this.time.startTime.toMillis();
        base.endTimeMillis = this.time.endTime.toMillis();
        return base;
    }
}

export type SerialisableSilentConfiguration = {
    description: string,
    type: string,
    dayOfMonth?: number,
    dayOfWeek?: number,
    startTimeMillis?: number,
    endTimeMillis?: number
}