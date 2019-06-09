const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { chain } = require('../handlers.utils');
const { validateCallbackValue } = require('../callback.validation');
const { validateUser, validateNoUser } = require('./validation');
const { formatUser } = require('./formatting');

const showCurrentUser = chain(
    validateUser,
    () => ({ user }) => `You are known as ${formatUser(user)}. :ok_hand:`,
);

const logInUser = chain(
    validateNoUser,
    ({ challongeService, userRepository }) => async ({ text, sender }) => {
        const challongeMembers = await challongeService.fetchMembers();

        const challongeUsername = text.split(/\s+/)[1];
        if (challongeUsername) {
            const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

            const user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
            return `Congrats! You are now known as ${formatUser(user)}. :tada:`;
        }

        const response = new SlackTemplate()
            .addAttachment('login')
            .addText('Who are you? :simple_smile:')
            .addColor('#252830');
        response.getLatestAttachment().actions = [
            {
                type: 'select',
                text: 'Select...',
                name: 'username',
                options: R.map(({ username }) => ({
                    text: username,
                    value: username,
                }))(challongeMembers),
            },
        ];
        return response.get();
    },
);

const logInUserCallback = chain(
    validateNoUser,
    validateCallbackValue('username', 'challongeUsername'),
    ({ challongeService, userRepository }) => async ({ sender, challongeUsername }) => {
        const challongeMembers = await challongeService.fetchMembers();
        const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

        const user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);

        return new SlackTemplate()
            .addAttachment('login_verified')
            .addText(`Who are you? :simple_smile:\n\nCongrats! You are now known as ${formatUser(user)}. :tada:`)
            .addColor('#252830')
            .get();
    },
);

const logOutUser = chain(
    validateUser,
    ({ userRepository }) => async ({ sender }) => {
        await userRepository.deleteUser(sender);
        return 'Okay, you are now forgotten. I hope to see you later! :wave:';
    },
);

module.exports = {
    showCurrentUser,
    logInUser,
    logInUserCallback,
    logOutUser,
};
