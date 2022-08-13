import * as fs from 'fs'
import { Config } from '../src/config.js';

/**
 * Class used by pagerbuddy test cases to obtain a valid config for testing. Typically, the standard config file can be used. However, feel free to define any other config.
 * The config is extended by a group id as test target (first item of the admin groups array).
 */
 export class TestConfig extends Config{

    /**
     * 
     * @param {string} config_file 
     */
    constructor(config_file = "./config.json"){
      const cli_string = "--pagerbuddy_config=" + config_file;
      super([cli_string], true);
  
      this.#setup_telegram_test();
      this.tests.skip_messaging = !this.messaging.enabled;
    }
  
    tests = {
      skip_telegram: true,
      telegram_test_group: 0,
      skip_messaging: true
    }
  
    #setup_telegram_test(){
      if(this.telegram.bot_token == "" || this.telegram.bot_name == ""){
        this.tests.skip_telegram = true;
        return;
      }
  
      const testgroup = this.telegram.admin_groups[0];
      if(!testgroup ||  testgroup == 0){
        this.tests.skip_telegram = true;
        return;
      }
  
      this.tests.skip_telegram = false;
      this.tests.telegram_test_group = testgroup;
    }
  
  }
  