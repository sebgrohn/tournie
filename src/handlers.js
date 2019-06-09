
module.exports = {
    ...require('./usage').handlers,
    ...require('./tournaments').handlers,
    ...require('./users').handlers,
    ...require('./matches').handlers,
};
