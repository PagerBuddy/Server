# PagerBuddy-Server [![Run Jest Tests](https://github.com/PagerBuddy/Server/actions/workflows/run_tests.yml/badge.svg)](https://github.com/PagerBuddy/Server/actions/workflows/run_tests.yml) [![Compile TypeScript](https://github.com/PagerBuddy/Server/actions/workflows/tsc.yml/badge.svg)](https://github.com/PagerBuddy/Server/actions/workflows/tsc.yml)

PagerBuddy is an open source project to propagate alerts for members of emergency services (firebrigades, medical, catastrophe response, ...). The project consists of three components: "[Interfaces](https://github.com/PagerBuddy/Interface)" forward incoming external alerts (e.g. from a physical pager) or generated alerts to the server. The "server" handles incoming information from many different interfaces, aggregates alerts and sends notifications to users (currently supporting Telegram and PagerBuddy-App). Users can optionally install the "[app](https://github.com/PagerBuddy/App)" to be notified in an urgent manner about alerts on their smartphone.

This repo is for the "server" component.

Currently supported:
* Incoming alerts: Websocket, [KatSys](https://www.fuf-frey.de/katsys/)
* PagerBuddy administration: [Telegram](https://telegram.org/) (through bot commands and inline actions)
* Outgoing alerts: [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) (FCM), [Apple Push Notification service](https://developer.apple.com/documentation/usernotifications) (routed through FCM), Telegram

## Installation

1. Install Node.js ([download installer](https://nodejs.org/en/download/), [use package manager](https://nodejs.org/en/download/package-manager/))

2. Clone this repository (if you have [git](https://git-scm.com/downloads))
   ```
   git clone https://github.com/PagerBuddy/Server.git
   ```
   or [download release](https://github.com/PagerBuddy/Server/releases/latest) and unpack to a location of your choice

3. Create a config.json with your settings (or edit [config-template.json](https://github.com/PagerBuddy/Server/blob/main/config-template.json) and save as config.json)

   Required parameters (have a look in the [wiki](https://github.com/PagerBuddy/Server/wiki/Configuration) for detailed descriptions and advice):
   * DATABASE_LOCATION
   * TELEGRAM
      * BOT_TOKEN and BOT_NAME
      * ADMIN_GROUPS
   * ALERT_TIME_ZONE
   
   All other parameters are optional and only have to be set if you want to use that functionality.

4. Install dependencies
   ```
   sudo npm install
   ```
   On linux systems, it is possible to install PagerBuddy as a systemd service via `npm run installservice` (you will be asked to enter your root password). The service will be enabled, but not automatically started. You can do so via `npm run startservice`. Some useful commands when working with the service are
      ```
      npm run startservice // start the service
      npm run stopservice // stop the service
      npm run uninstallservice // stops and removes the service
      journalctl -f -u pagerbuddy // View the service log, updating live
      ```
5. You are good to go. If you are not using the service you can start the server with
   ```
   npm start
   ```

## Documentation
Checkout the [wiki](https://github.com/PagerBuddy/Server/wiki) for concepts an general usage information. We are constantly extending the wiki content.  
Look [here](https://pagerbuddy.github.io/Server/) for a compiled version of the code markup. 

## Apps
Currently the apps for iOS and Android can only be used with the "original" server instance. This will change very soon - making the app usable for any server operator. You will however have to operate a FCM project for your server (free). Until then have a look at the apps:
* Android: [PlayStore](https://play.google.com/store/apps/details?id=de.bartunik.pagerbuddy&hl=en&gl=US)
* iOS: [App Store](https://apps.apple.com/us/app/pagerbuddy/id1607587265)

## Legal
It may not be legal to forward messages/alerts to people that are not intended recipients in your location (e.g. Germany). It is your responsibility to ensure you only use PagerBuddy in a legal way!
