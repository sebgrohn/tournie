const { SimpleDB } = require('aws-sdk');
const R = require('ramda');
const axios = require('axios');
const botBuilder = require('claudia-bot-builder');
const botFactory = require('./src/bot');
// eslint-disable-next-line node/no-missing-require
const { apiKey, organization } = require('./challonge');
const region = require('./aws-region');
const challongeServiceFactory = R.applySpec(require('./src/challonge.service'));
const handlersFactory = R.applySpec(require('./src/handlers'));
const userRepositoryFactory = R.applySpec(require('./src/user.repository'));

const api = axios.create({
    baseURL: 'https://api.challonge.com/v1/',
    params: {
        api_key: apiKey,
    },
});
const simpleDb = new SimpleDB({ region });

const challongeService = challongeServiceFactory({ api, organization });
const userRepository = userRepositoryFactory(simpleDb);
const handlers = handlersFactory({ challongeService, userRepository });
const bot = botFactory(handlers);

// TODO this is an async operation; we don't know now if things go wrong...
userRepository.initialize();

module.exports = botBuilder(bot, { platforms: ['slackSlashCommand'] });
