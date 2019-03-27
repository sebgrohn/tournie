const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { chain, validateCallbackValue } = require('./handlers.utils');

const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['connect [<challonge_username>]', 'connect your Slack and Challonge accounts'],
    ['disconnect', 'disconnect your Slack and Challonge accounts'],
    ['signup', 'sign up for a tournament'],
    ['next', 'list open matches in tournaments you are part of'],
    ['help', 'show this information'],
];

const showUsage = () => ({ originalRequest }) => {
    const { command } = originalRequest;
    const supportedCommandsString = R.pipe(
        R.map(([c, d]) => `• \`${command} ${c}\` to ${d}`),
        R.join('\n'),
    )(supportedCommands);

    return new SlackTemplate()
        .addAttachment('usage')
        .addText(`*Supported commands:*\n${supportedCommandsString}`)
        .addColor('#252830')
        .addAction('Close', 'close', 'close')
        .get();
};

const closeUsageCallback = chain(
    validateCallbackValue('close'),
    () => () => ({ delete_original: true }), // NOTE SlackTemplate doesn't support this flag
);

module.exports = {
    showUsage,
    closeUsageCallback,
    ...require('./tournaments').handlers,
    ...require('./users').handlers,
    ...require('./matches').handlers,
};
