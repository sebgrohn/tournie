const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('./HandlerError');
const { formatUser } = require('./formatting');

const chain = (...fs) => deps =>
    R.pipe(
        R.map(f => f(deps)),
        R.map(f => v => Promise.resolve(v).then(f)),
        R.pipeWith((f, v) => v.then(f)),
    )(fs);

const concurrent = (...fs) => deps => message =>
    R.pipe(
        R.map(f => f(deps)),
        R.map(f => Promise.resolve(message).then(f)),
        vs => Promise.all(vs)
            .then(R.reduce((acc, v) => ({ ...acc, ...v }), {})),
    )(fs);

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

const validateCallbackValue = (actionName, valuePropName = 'callbackValue') => () => message => {
    const { originalRequest } = message;
    const callbackValue = parseCallbackValue(actionName, originalRequest);
    return callbackValue
        ? Promise.resolve({ ...message, [valuePropName]: callbackValue })
        : Promise.reject(new HandlerError(
            `Invalid action value(s) for callback: ${originalRequest.callbackId}`,
        ));
};

const tryGetCallbackValue = (actionName, valuePropName = 'callbackValue') => () => message => {
    const { originalRequest } = message;
    const callbackValue = parseCallbackValue(actionName, originalRequest);
    return Promise.resolve(callbackValue
        ? { ...message, [valuePropName]: callbackValue }
        : message,
    );
};

const parseCallbackValue = (actionName, { actions }) =>
    R.pipe(
        R.filter(({ name }) => name === actionName),
        R.chain(({ selected_options, value }) => selected_options
            ? selected_options
            : [{ value }],
        ),
        R.map(({ value }) => value),
        R.head,
    )(actions) || {};

module.exports = {
    chain,
    concurrent,
    validateUser,
    validateNoUser,
    tryGetUser,
    validateCallbackValue,
    tryGetCallbackValue,
    parseCallbackValue,
};
