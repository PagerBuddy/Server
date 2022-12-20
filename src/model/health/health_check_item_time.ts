import { DateTime, Duration } from "luxon";
import TelegramConnector from "../../connectors/telegram.js";
import HealthCheckItem from "./health_check_item.js";


export default class HealthCheckItemTime extends HealthCheckItem{

    private healthCheckCallback: () => Promise<DateTime>;

    constructor(name: string, description: string, toleranceDuration: Duration, healthCheckCallback: () => Promise<DateTime>){
        super(name, description, toleranceDuration);
        this.healthCheckCallback = healthCheckCallback;
    }

    public async isHealthy() : Promise<boolean>{
        const lastHealthyTime = await this.healthCheckCallback();

        if(lastHealthyTime.diffNow() < super.toleranceDuration){
            super.unhealthySince = DateTime.invalid("Placeholder");
            return true;
        }else{
            super.unhealthySince = lastHealthyTime;
            return false;
        }
    }

    public static getTelegramCheckItem(): HealthCheckItemTime{
        return new HealthCheckItemTime(
            "Telegram Status",
            "Requests to Telegram are successfull.",
            Duration.fromObject({seconds: 30}),
            async () => {
                const failMoment = TelegramConnector.getInstance()?.errorStatusSince;
                if(!failMoment?.isValid){
                    return DateTime.now();
                }else{
                    return failMoment;
                }
            }
        )
    }
}