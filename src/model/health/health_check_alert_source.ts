import { Duration } from "luxon";
import AlertSource from "../sources/alert_source.js";
import AlertSourceHardwareInterface from "../sources/alert_source_hardware_interface.js";
import HealthCheckItem, { HealthCheckItemReport } from "./health_check_item.js";
import HealthCheckItemTime from "./health_check_item_time.js";


export default class HealthCheckAlertSource{

    private alertSource: AlertSource;
 
    public alertHealthCheck: HealthCheckItemTime;

    public statusHealthCheck: HealthCheckItemTime;

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

    public async getReport() : Promise<HealthCheckAlertSourceReport>{
        const report : HealthCheckAlertSourceReport = {
            sourceDescription: this.sourceDescription,
            overallStatus: await this.isHealthy(),
            checks: [await this.alertHealthCheck.getReport(), await this.statusHealthCheck.getReport()]
        }

        if(this.alertSource instanceof AlertSourceHardwareInterface){
            report.sourceSiteId = this.alertSource.siteId;
        }
        return report;
    }
}

export type HealthCheckAlertSourceReport = {
    sourceDescription: string,
    sourceSiteId?: string,
    overallStatus: boolean,
    checks: HealthCheckItemReport[]
}