const BaseError = require('./BaseError');

class InvalidUserInputError extends BaseError {
    constructor(message) {
        super(message);
    }
}

class InvalidCallbackActionError extends BaseError {
    constructor({ callbackId }) {
        super(`Invalid action value(s) for callback: ${callbackId}`);
    }
}

module.exports = {
    InvalidUserInputError,
    InvalidCallbackActionError,
};
