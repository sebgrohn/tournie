const R = require('ramda');

const parseCallbackValue = (actionName, { actions }) =>
    R.pipe(
        R.filter(({ name }) => name === actionName),
        R.map(({ selected_options, value }) => selected_options
            ? selected_options
            : [{ value }]),
        R.unnest,
        R.map(({ value }) => value),
        R.head,
    )(actions) || {};

module.exports = {
    parseCallbackValue,
};
