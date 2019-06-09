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

module.exports = {
    chain,
    concurrent,
};
