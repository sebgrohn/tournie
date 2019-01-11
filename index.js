const botBuilder = require('claudia-bot-builder');
const challongeServiceFactory = require('./src/challonge.service');
const userRepositoryFactory = require('./src/user.repository');
const botFactory = require('./src/bot');
const challongeConfig = require('./challonge');
const region = require('./aws-region');

const challongeService = challongeServiceFactory(challongeConfig);
const userRepository = userRepositoryFactory({ region });
const bot = botFactory(challongeService, userRepository);

// TODO this is an async operation; we don't know now if things go wrong...
userRepository.initialize();

module.exports = botBuilder(bot, { platforms: ['slackSlashCommand'] });
