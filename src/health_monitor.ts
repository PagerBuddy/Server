import { DateTime } from "luxon";
import HealthCheckAlertSource, { HealthCheckAlertSourceReport } from "./model/health/health_check_alert_source";
import HealthCheckItem, { HealthCheckItemReport } from "./model/health/health_check_item";
import HealthCheckItemBool from "./model/health/health_check_item_bool";
import HealthCheckItemTime from "./model/health/health_check_item_time";
import AlertSource from "./model/sources/alert_source";
import AlertSourceHardwareInterface from "./model/sources/alert_source_hardware_interface";
import AlertSourceKatSys from "./model/sources/alert_source_katsys";
import AlertSourceManual from "./model/sources/alert_source_manual";

export default class HealthMonitor{

    private static instance: HealthMonitor;

    private specialHealthChecks : HealthCheckItem[] = [];
    private sourceHealthChecks : HealthCheckAlertSource[] = [];

    private checkTimer? : NodeJS.Timer;

    //TODO: Time based monitoring and output notifications (Telegram/E-Mail)

    public static async getInstance() : Promise<HealthMonitor>{
        if(!HealthMonitor.instance){
            const hM = new HealthMonitor();
            hM.fillSpecialChecks();
            await hM.fillSourceChecks();
            HealthMonitor.instance = hM;
        }
        return HealthMonitor.instance;
    }

    private constructor(){}

    public startMonitoring(checkIntervalSeconds: number){
        this.checkTimer = setInterval(this.checkHealth, checkIntervalSeconds*1000);
    }

    public stopMonitoring(){
        if(this.checkTimer){
            clearInterval(this.checkTimer);
        }
    }


    /**
     * Check if the health status has changed and report any substantial updates.
     * Intended for periodic health checks.
     */
    private async checkHealth(){
        //TODO: Implement this
        this.sourceHealthChecks.forEach(async sourceCheck => {
            const alertStat = await sourceCheck.alertHealthCheck.isHealthy();
            if(sourceCheck.alertHealthCheck.notifiedAsUnhealthyStatus != alertStat){
                sourceCheck.alertHealthCheck.notifiedAsUnhealthyStatus = alertStat;
                this.reportSourceStatusChange(sourceCheck, sourceCheck.alertHealthCheck, alertStat);
            }
            const statusStat = await sourceCheck.statusHealthCheck.isHealthy();
            if(sourceCheck.statusHealthCheck.notifiedAsUnhealthyStatus != statusStat){
                this.reportSourceStatusChange(sourceCheck, sourceCheck.statusHealthCheck, statusStat);
            }
        });
        this.specialHealthChecks.forEach(async specialCheck => {
            const specialStat = await specialCheck.isHealthy();
            if(specialCheck.notifiedAsUnhealthyStatus != specialStat){
                this.reportStatusChange(specialCheck, specialStat);
            }
        });

    }

    private static toTextDescription(state: boolean) : string{
        if(state){
            return "Status: OK";
        }else{
            return "Status: NOT OK";
        }
    }

    private reportSourceStatusChange(sourceCheck: HealthCheckAlertSource, healthCheck: HealthCheckItem, newState: boolean) : void{
        const text = [];
        text.push(sourceCheck.sourceDescription, "\n", healthCheck.description, "\n", HealthMonitor.toTextDescription(newState), "\n");
        this.outputHealth(text.join(""));
    }

    private reportStatusChange(healthCheck: HealthCheckItem, newState: boolean) : void{
        const text = [];
        text.push(healthCheck.description, "\n", HealthMonitor.toTextDescription(newState), "\n");
        this.outputHealth(text.join(""));
    }

    private outputHealth(message: string): void{
        const outText = "New status change:\n" + message;
        //TODO: Output this to email/Telegram/...
    }

    private async fillSourceChecks() : Promise<void> {
        const sources : AlertSource[] = [] ;

        sources.push(... await AlertSourceHardwareInterface.find());
        sources.push(... await AlertSourceKatSys.find());

        sources.forEach(source => {
            const checkItem = new HealthCheckAlertSource(source);
            this.sourceHealthChecks.push(checkItem);
        });
    }

    private fillSpecialChecks() : void {
        this.specialHealthChecks.push(HealthCheckItemBool.getInternetCheckItem());
        this.specialHealthChecks.push(HealthCheckItemTime.getTelegramCheckItem());
    }

    private async isAllHealthy() : Promise<boolean> {
        this.sourceHealthChecks.forEach(async sourceCheck => {
            if(!await sourceCheck.isHealthy()){
                return false;
            }
        });
        this.specialHealthChecks.forEach(async specialCheck => {
            if(!await specialCheck.isHealthy()){
                return false;
            }
        });
        return true;
    }

    public async getHealthReport() : Promise<HealthReport> {

        const sourceReports : HealthCheckAlertSourceReport[] = [];
        this.sourceHealthChecks.forEach(async source => {
            sourceReports.push(await source.getReport());
        })

        const otherReports : HealthCheckItemReport[] = [];
        this.specialHealthChecks.forEach(async check => {
            otherReports.push(await check.getReport());
        })

        const report : HealthReport = {
            timestamp: DateTime.now(),
            overallStatus: await this.isAllHealthy(),
            alertSourceStatus: sourceReports,
            otherStatus: otherReports
        }

        return report;
    }
    
}

export type HealthReport = {
    timestamp: DateTime,
    overallStatus: boolean,
    alertSourceStatus: HealthCheckAlertSourceReport[],
    otherStatus: HealthCheckItemReport[]
}



