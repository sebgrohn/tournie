const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { chain } = require('../handlers.utils');
const { validateCallbackValue } = require('../callback.validation');
const commandDescriptions = require('./commandDescriptions');

const showUsage = () => ({ originalRequest }) => {
    const { command } = originalRequest;
    const commandDescriptionsString = R.pipe(
        R.map(([c, d]) => `• \`${command} ${c}\` to ${d}`),
        R.join('\n'),
    )(commandDescriptions);

    return new SlackTemplate()
        .addAttachment('usage')
        .addText(`*Supported commands:*\n${commandDescriptionsString}`)
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
};
