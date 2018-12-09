const axios = require('axios');
const botBuilder = require('claudia-bot-builder');
const challongeServiceFactory = require('./src/challonge.service');
const botFactory = require('./src/bot');
const challongeConfig = require('./challonge');

const challongeService = challongeServiceFactory(challongeConfig);
const bot = botFactory(challongeService);

module.exports = botBuilder(bot, { platforms: ['slackSlashCommand'] });
