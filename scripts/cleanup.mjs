/**@module scripts/cleanup */

import {uninstall_service} from "./service.mjs";
import { unlinkSync, readFileSync } from "fs";

/**
 * 
 * @param {String} config_file 
 * @returns {any} JSON File containing the configuration
 */
function read_config(config_file) {
    return JSON.parse(readFileSync(config_file).toString())
}
/**
 * 
 * @param {any} conf 
 */
function remove_custom_data(conf){
    const config_path = "./config.json";
    /**
     * Deletes the DB and config.json on uninstall.
     */

    try{
        unlinkSync(conf['DATABASE_LOCATION']);
    }catch (err){
        console.log(err);
    }

    try{
        unlinkSync(config_path);
    }catch(err){
        console.log(err);
    }
    
}


const curr_config_location='./config.json'
const config = read_config(curr_config_location);
uninstall_service();
remove_custom_data(config);
