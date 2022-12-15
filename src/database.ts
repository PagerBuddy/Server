import { DataSource } from "typeorm";
import Log from "./log";

export default class Database{

    private static log = Log.getLogger(Database.name);

    //TODO: Fill with sensible values and decide on db technology
    private static appDataSource = new DataSource({
        type: "sqlite",
        database: ""
    });

    public static async connect() : Promise<void>{
        try{
            await Database.appDataSource.initialize()
        }catch(error: any){
            Database.log.error("Error initialising database. This is fatal.");
            Database.log.error(error);
        }
    }

    public static async disconnect() : Promise<void>{
        if(Database.appDataSource.isInitialized){
            await Database.appDataSource.destroy();
        }
    }
}