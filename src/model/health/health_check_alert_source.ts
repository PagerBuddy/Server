import { Duration } from "luxon";
import AlertSource from "../sources/alert_source";
import HealthCheckItem from "./health_check_item";
import HealthCheckItemTime from "./health_check_item_time";


export default class HealthCheckAlertSource{

    private alertSource: AlertSource;
 
    private alertHealthCheck: HealthCheckItemTime;

    private statusHealthCheck: HealthCheckItemTime;

    public get sourceDescription() : string {
        return this.alertSource.description;
    }

    constructor(alertSource: AlertSource){
        const alertHealth = new HealthCheckItemTime(
            "Alerts",
            "An Alert has been received in a reasonable time frame.",
            Duration.fromObject({hours: 3}),
            async () => {
                return alertSource.lastAlertTimestamp;
            }
        );

        const statusHealth = new HealthCheckItemTime(
            "Status",
            "A status ping has been received in a reasonable time frame.",
            Duration.fromObject({seconds: 30}),
            async () => {
                return alertSource.lastStatusTimestamp;
            }
        );

        this.alertSource = alertSource;
        this.alertHealthCheck = alertHealth;
        this.statusHealthCheck = statusHealth;
    }

    public async isHealthy() : Promise<boolean> {
        return await this.alertHealthCheck.isHealthy() && await this.statusHealthCheck.isHealthy();
    }


}