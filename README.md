# PagerBuddy-Server [![Run Jest Tests](https://github.com/PagerBuddy/Server/actions/workflows/run_tests.yml/badge.svg)](https://github.com/PagerBuddy/Server/actions/workflows/run_tests.yml) [![Compile TypeScript](https://github.com/PagerBuddy/Server/actions/workflows/tsc.yml/badge.svg)](https://github.com/PagerBuddy/Server/actions/workflows/tsc.yml)


---
Install:

    //Before install adapt config-template.json and save as config.json or add config.json to lazy-develop
    
    npm install             //creates dependencies
    npm run postinstall     //checkes for config.json and data.db - creates from scripts/lazy-develop if available and necessary, installs and enables service

Service:

    npm run startservice    //service is installed and enabled in postinstall on linux
    

View logs/status (linux service):

    sudo systemctl status pagerbuddyserver.service
    journalctl -f -u pagerbuddyserver.service

Start manually:

    npm start
    
----
