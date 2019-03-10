const BaseError = require('../BaseError');

class HandlerError extends BaseError {
    constructor(message) {
        super();
        this.userMessage = message;
    }
}

module.exports = HandlerError;
