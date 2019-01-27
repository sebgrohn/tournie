const { SimpleDB, Lambda } = require('aws-sdk');
const R = require('ramda');
const axios = require('axios');
const botBuilder = require('claudia-bot-builder');
const slackDelayedReply = botBuilder.slackDelayedReply;
const botFactory = require('./src/bot');
// eslint-disable-next-line node/no-missing-require
const { apiKey, organization } = require('./challonge');
const region = require('./aws-region');
const challongeServiceFactory = R.applySpec(require('./src/challonge.service'));
const handlersFactory =  R.applySpec(require('./src/handlers'));
const userRepositoryFactory = R.applySpec(require('./src/user.repository'));

const api = axios.create({
    baseURL: 'https://api.challonge.com/v1/',
    params: {
        api_key: apiKey,
    },
});
const simpleDb = new SimpleDB({ region });
const lambda = new Lambda({ region });

const challongeService =  challongeServiceFactory({ api, organization });
const userRepository = userRepositoryFactory(simpleDb);
const handlers = handlersFactory({ challongeService, userRepository });
const bot = botFactory(handlers);

// TODO this is an async operation; we don't know now if things go wrong...
userRepository.initialize();

async function delayedBot(message, apiRequest) {
    // TODO should message action callbacks also be delayed?
    await lambda.invoke({
        FunctionName: apiRequest.lambdaContext.functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify({
            slackEvent: message,
        }),
        Qualifier: apiRequest.lambdaContext.functionVersion,
    }).promise();
    // TODO What to return here to not get duplicate responses (immediate + delayed)? I have tried
    //      * undefined => "{}",
    //      * false => "false",
    //      * true => ?,
    //      * {} => "{}", and
    //      * '' => Slack error.
    //      replaceOriginal on the delayed response doesn't have any effect.
    return {};
}

const botApi = botBuilder(delayedBot, { platforms: ['slackSlashCommand'] });

botApi.intercept(async (event) => {
    const { slackEvent: message } = event;
    if (!message) {
        // if this is a normal web request, let it run
        return event;
    }

    await slackDelayedReply(message, await bot(message));
    return false;
});

module.exports = botApi;
