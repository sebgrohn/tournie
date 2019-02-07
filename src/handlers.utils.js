const R = require('ramda');

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
    parseCallbackValue,
};
