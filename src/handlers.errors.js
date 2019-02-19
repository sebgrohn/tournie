const BaseError = require('./BaseError');

class InvalidCallbackActionError extends BaseError {
    constructor({ callbackId }) {
        super(`Invalid action value(s) for callback: ${callbackId}`);
    }
}

module.exports = {
    InvalidCallbackActionError,
};
