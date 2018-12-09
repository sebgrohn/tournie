const axios = require('axios');
const botBuilder = require('claudia-bot-builder');
const botFactory = require('./src/bot');
const { organization, apiKey } = require('./challonge');

const challongeApi = axios.create({
    baseURL: 'https://api.challonge.com/v1/',
    params: {
        api_key: apiKey,
    },
});
const bot = botFactory(challongeApi);

module.exports = botBuilder(bot, { platforms: ['slackSlashCommand'] });
