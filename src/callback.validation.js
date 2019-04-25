const R = require('ramda');
const HandlerError = require('./HandlerError');

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
    validateCallbackValue,
    tryGetCallbackValue,
    parseCallbackValue,
};
