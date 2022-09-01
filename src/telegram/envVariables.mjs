"use strict";

/**@module telegram/envVariables */
//Needed for Telegram Bot

//See why this is necessary: https://stackoverflow.com/questions/51729775/node-programmatically-set-process-environment-variables-not-available-to-importe

// https://github.com/yagop/node-telegram-bot-api/issues/540
process.env.NTBA_FIX_319 = '1';