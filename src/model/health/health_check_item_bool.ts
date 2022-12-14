import { DateTime, Duration } from "luxon";
import HealthCheckItem from "./health_check_item";
import { resolve as dnsResolve } from 'dns'


export default class HealthCheckItemBool extends HealthCheckItem{

    private healthCheckCallback: () => Promise<boolean>;

    constructor(name: string, description: string, toleranceDuration: Duration, healthCheckCallback: () => Promise<boolean>){
        super(name, description, toleranceDuration);
        this.healthCheckCallback = healthCheckCallback;
    }

    public async isHealthy() : Promise<boolean>{
        const healthy = await this.healthCheckCallback();

        if(healthy || !super.unhealthySince.isValid){
            super.unhealthySince = DateTime.invalid("Placeholder");
            return true;
        }else if(super.unhealthySince.diffNow() < this.toleranceDuration){
            //We are in tolerance time - wait out
            return true;
        }else{
            return false;
        }

    }

    public static getInternetCheckItem() : HealthCheckItemBool{
        return new HealthCheckItemBool(
            "Internet Status",
            "A DNS request to google can be resolved successfully.",
            Duration.fromObject({seconds: 30}),
            async () => {
                return new Promise((resolve) => {
                    dnsResolve('www.google.com', function (err) {
                        resolve(!err);
                    });
                })
            }
        );
    }
    
}