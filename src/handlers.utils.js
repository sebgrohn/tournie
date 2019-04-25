const R = require('ramda');
const HandlerError = require('./HandlerError');

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
    validateCallbackValue,
    tryGetCallbackValue,
    parseCallbackValue,
};
