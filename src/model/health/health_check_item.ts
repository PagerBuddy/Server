import { DateTime, Duration } from "luxon";


export default abstract class HealthCheckItem{

    public readonly name: string;

    public readonly description: string;

    /**
     * Within tolerance duration (falsely) report a good state, as the state may recover quickly.
     */
    protected toleranceDuration: Duration;

    public unhealthySince: DateTime = DateTime.invalid("Placeholder");

    constructor(name: string, description: string, toleranceDuration: Duration){
        this.name = name;
        this.description = description;
        this.toleranceDuration = toleranceDuration;
    }

    public abstract isHealthy() : Promise<boolean>;
}