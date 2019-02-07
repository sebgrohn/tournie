const R = require('ramda');

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
    parseCallbackValue,
};
