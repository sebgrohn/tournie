const R = require('ramda');
const S = require('sanctuary');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { InvalidCallbackActionError } = require('./handlers.errors');

const chain = (...fs) => deps =>
    R.pipe(
        R.map(f => f(deps)),
        R.pipeWith((f, p) => Promise.resolve(p)
            .then(e => S.isRight(e)
                ? f(S.fromEither({})(e))
                : e)),
    )(fs);

const concurrent = (...fs) => deps => v =>
    R.pipe(
        R.map(f => f(deps)),
        R.map(f => f(v)),
        ps => Promise.all(ps),
        p => p.then(R.reduce(
            (accE, e) => S.chain(
                acc => S.map(R.mergeRight(acc))(e),
            )(accE),
        )(S.Right({}))),
    )(fs);

const validateUser = ({ userRepository }) => async message => {
    const { sender } = message;
    const user = await userRepository.getUser(sender);
    return user
        ? Promise.resolve({ ...message, user })
        : Promise.reject(
            new SlackTemplate('I don\'t know who you are. :crying_cat_face:')
                .replaceOriginal(false)
                .get(),
        );
};

const validateCallbackValue = actionName => () => async message => {
    const { originalRequest } = message;
    const callbackValue = parseCallbackValue(actionName, originalRequest);
    return callbackValue
        ? Promise.resolve({ ...message, callbackValue })
        : Promise.reject(new InvalidCallbackActionError(originalRequest));
};

const parseCallbackValue = (actionName, { actions }) =>
    R.pipe(
        R.filter(({ name }) => name === actionName),
        R.chain(({ selected_options, value }) => selected_options
            ? selected_options
            : [{ value }]),
        R.map(({ value }) => value),
        R.head,
    )(actions) || {};

module.exports = {
    chain,
    concurrent,
    validateUser,
    validateCallbackValue,
    parseCallbackValue,
};
