import fs from "fs";
import promptSync from "prompt-sync";
import {CONFIG_FILE_LOCATION, PagerBuddyConfig} from "../src/model/system_configuration.js";

const DEFAULT_FIREBASE_FILE = "./firebase_credentials.json";

const prompt = promptSync();

createConfig();

function createConfig() : void{
    if(checkConfig(CONFIG_FILE_LOCATION)){
        console.log("Found config file at default location to use.");
        return;
    }

    const databaseLoc = promptDatabase();
    const firebaseLoc = promptFirebase();

    const newConfig : PagerBuddyConfig = {
        DATABASE_URL: databaseLoc,
        FIREBASE_CREDENTIAL_LOCATION: firebaseLoc
    };

    fs.writeFileSync(CONFIG_FILE_LOCATION, JSON.stringify(newConfig, null, 4));
}

function promptFirebase() : string{
    console.info(`\nAnd now the relative location of your firebase credentials file (such as ${DEFAULT_FIREBASE_FILE}):`);
    const firebaseCred = prompt("> ", DEFAULT_FIREBASE_FILE);
    if(!firebaseCred){
        console.error("This is a mandatory parameter.");
        return promptFirebase();
    }
    return firebaseCred;
}

function promptDatabase() : string{
    console.info("Enter the URL to a PostgreSQL database instance to use:");
    const databaseURL = prompt("> ", "");
    if(!databaseURL || databaseURL.length == 0){
        console.error("This is a mandatory parameter.");
        return promptDatabase();
    }
    return databaseURL;
}

function checkConfig(file: string) : boolean {
    if(fileExists(file)){
        const rawConfig = fs.readFileSync(CONFIG_FILE_LOCATION, {encoding: "utf8"});
        let jsonConfig : PagerBuddyConfig = {};
        try{
            jsonConfig = JSON.parse(rawConfig);
        }catch(error: any){
            console.error(`Config file found at ${CONFIG_FILE_LOCATION} could not be parsed. Ignoring it.`);
            return false;
        }

        if(itemExists(jsonConfig.DATABASE_URL) && itemExists(jsonConfig.FIREBASE_CREDENTIAL_LOCATION)){
            return true;
        }else{
            console.error(`Config file found at ${CONFIG_FILE_LOCATION} does not contain necessary elements. Ignoring it.`)
        }
    }
    return false;
}

function itemExists(item: string | undefined) : boolean{
    if(item && item.length > 0){
        return true;
    }
    return false;
}

function fileExists(file: string): boolean {
    try {
        if (fs.existsSync(file)) {
            return true;
        }
    } catch (err: any) {
        console.error(err);
    }
    return false;
}

