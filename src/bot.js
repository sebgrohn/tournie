const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { InvalidUserInputError } = require('./handlers.errors');

const defaultCommand = 'tournaments';

function botFactory(handlers) {
    const commandHandlers = {
        tournaments: handlers.listOpenTournaments,
        whoami: handlers.showCurrentUser,
        connect: handlers.logInUser,
        disconnect: handlers.logOutUser,
        login: handlers.logInUser, // alias for easy discovery
        logout: handlers.logOutUser, // alias for easy discovery
        next: handlers.listNextMatches,
        help: handlers.showUsage,
        usage: handlers.showUsage, // alias for easy discovery
    };

    const callbackHandlers = {
        tournament: handlers.signUpUserCallback,
        login: handlers.logInUserCallback,
        usage: handlers.closeUsageCallback,
    };

    return async function bot(message) {
        const { text, originalRequest } = message;
        const { callback_id } = originalRequest;

        const command = (text || '').split(/\s+/)[0];
        const callback = (callback_id || '').split(/-/)[0];

        try {
            const handleMessage = callback
                ? callbackHandlers[callback] || handleUnknownCallback
                : commandHandlers[command || defaultCommand] || handleUnknownCommand;
            return await handleMessage(message);
        } catch (error) {
            return await R.cond([
                [e => e instanceof InvalidUserInputError, e => e.message],
                [e => e instanceof Error, e => handleError(message, e)],
                [R.T, R.identity],
            ])(error);
        }
    };

    function handleUnknownCommand({ originalRequest }) {
        const { command } = originalRequest;
        return `:trophy: This is not how you win a game... Try \`${command} help\`.`;
    }

    function handleUnknownCallback({ originalRequest }) {
        const { callback_id } = originalRequest;
        throw new Error(`Missing handler for callback: ${callback_id}`);
    }

    function handleError(_, { response, message }) {
        const errorMessage = response
                && `${response.status} – ${JSON.stringify(response.data)}`
            || message;
        return new SlackTemplate(`:crying_cat_face: There was an error: \`${errorMessage}\`.`)
            .replaceOriginal(false)
            .get();
    }
}

module.exports = botFactory;
