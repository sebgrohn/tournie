const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('../HandlerError');
const { formatUser } = require('./formatting');

const validateUser = ({ userRepository }) => async message => {
    const { sender } = message;
    const user = await userRepository.getUser(sender);
    return user
        ? Promise.resolve({ ...message, user })
        : Promise.reject(new HandlerError(
            new SlackTemplate('I don\'t know who you are. :crying_cat_face:')
                .replaceOriginal(false)
                .get(),
        ));
};

const validateNoUser = ({ userRepository }) => async message => {
    const { sender } = message;
    const user = await userRepository.getUser(sender);
    return user
        ? Promise.reject(new HandlerError(
            new SlackTemplate(`You are already logged in as ${formatUser(user)}. :angry:`)
                .replaceOriginal(false)
                .get(),
        ))
        : Promise.resolve(message);
};

const tryGetUser = ({ userRepository }) => async message => {
    const { sender } = message;
    const user = await userRepository.getUser(sender);
    return Promise.resolve(user
        ? { ...message, user }
        : message,
    );
};

module.exports = {
    validateUser,
    validateNoUser,
    tryGetUser,
};
