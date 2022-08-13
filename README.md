# PagerBuddy-Server [![Run Jest Tests](https://github.com/PagerBuddy/Server/actions/workflows/run_tests.yml/badge.svg)](https://github.com/PagerBuddy/Server/actions/workflows/run_tests.yml) [![Compile TypeScript](https://github.com/PagerBuddy/Server/actions/workflows/tsc.yml/badge.svg)](https://github.com/PagerBuddy/Server/actions/workflows/tsc.yml)

PagerBuddy is an OpenSource project to propagate alerts for members of emergency services (firebrigades, medical, catastrophe response, ...). The project consists of three components: "Interfaces" forward incoming external alerts (f.e. from a physical pager) or generated alerts to the server. The "server" handles incoming information from many different interfaces, aggregates alerts and sends notifications to users (currently supporting Telegram and PagerBuddy-App). Users can optionally install the "app" to be notified in an urgent manner about alerts on their smartphone.

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
   or [download ZIP](https://github.com/PagerBuddy/Server/archive/refs/heads/main.zip) and unpack to a location of your choice

3. Create a config.json with your settings (or edit [config-template.json](https://github.com/PagerBuddy/Server/blob/main/config-template.json) and save as config.json)

   Required parameters:
   * DATABASE_LOCATION - Where your database file should live (relative to code). Usually the template default should be fine.
   * TELEGRAM
      * BOT_TOKEN and BOT_NAME - You will have to create a Telegram bot with [BotFather](https://core.telegram.org/bots#6-botfather) to get these. Do not worry, it is really simple.
      * ADMIN_GROUPS - An array of Telegram chat ids (like -123456, bots like @raw_data_bot can help you find this) that are authorised to manage the server. Best to use a group. 
   * ALERT_TIME_ZONE - An IANA timezone string ([Zone ID list](https://nodatime.org/TimeZones)). Outgoing alerts will be set in this timezone.
   
   All other parameters are optional and only have to be set if you want to use that functionality.

4. Install dependencies
   ```
   npm install
   ```
   On linux systems this will also add a systemd service to automatically start the server on boot (add ```NO_SERVICE=true``` to install without service). After install the service is in the stopped state. Some useful commands when working with the service are
      ```
      sudo systemctl start pagerbuddy //start the service
      sudo systemctl stop pagerbuddy //stop the service
      journalctl -f -u pagerbuddy //View the service log, updating live
      ```
5. You are good to go. If you are not using the service you can start the server with
   ```
   npm start
   ```

## Documentation
We are working on a wiki and compiled version of the code markup. Hang tight!
In the meantime feel free to ask any questions or problems you may have in the form of an issue...

## Apps
Currently the apps for iOS and Android can only be used with the "original" server instance. This will change very soon - making the app usable for any server operator. You will however have to operate a FCM project for your server (free). Untill then have a look at the apps (currently in Beta, moving to production release soon):
* Androoid: [PlayStore](https://play.google.com/store/apps/details?id=de.bartunik.pagerbuddy&hl=en&gl=US)
* iOS: [TestFlight in App Store](https://testflight.apple.com/join/C0bsfa5g)

## Legal
It may not be legal to forward messages/alerts to people that are not intended recipients in your location (f.e. Germany). It is your responsibility to ensure you only use PagerBuddy in a legal way!
