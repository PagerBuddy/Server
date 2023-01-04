import {CONFIG_FILE_LOCATION} from "../src/model/system_configuration.js";
import { unlinkSync } from "fs";
import { uninstall } from "./service.js";

function removeConfig() : void{
    /**
     * Deletes config.json on uninstall.
     */

    try{
        unlinkSync(CONFIG_FILE_LOCATION);
    }catch (err){
        console.log(err);
    }    
}


removeConfig();
uninstall();