const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('./handlers/HandlerError');

const defaultCommand = 'tournaments';

function botFactory(handlers) {
    const commandHandlers = {
        tournaments: handlers.listOpenTournaments,
        whoami: handlers.showCurrentUser,
        connect: handlers.logInUser,
        disconnect: handlers.logOutUser,
        login: handlers.logInUser, // alias for easy discovery
        logout: handlers.logOutUser, // alias for easy discovery
        signup: handlers.signUpUser,
        next: handlers.listNextMatches,
        help: handlers.showUsage,
        usage: handlers.showUsage, // alias for easy discovery
    };

    const callbackHandlers = {
        tournament: handlers.signUpUserFromListCallback,
        login: handlers.logInUserCallback,
        signup: handlers.signUpUserCallback,
        usage: handlers.closeUsageCallback,
    };

    return async function bot(message) {
        const { text, originalRequest } = message;
        const { callback_id } = originalRequest;

        const command = R.pipe(
            R.split(/\s+/),
            R.head,
        )(text || '');

        const callback = R.pipe(
            R.split(/-/),
            R.head,
        )(callback_id || '');

        const isDebug = R.pipe(
            R.split(/\s+/),
            R.map(R.equals('--debug')),
            R.last,
        )(text || '');

        let response;
        try {
            const handleMessage = callback
                ? callbackHandlers[callback] || handleUnknownCallback
                : commandHandlers[command || defaultCommand] || handleUnknownCommand;
            response = await handleMessage(message);
        } catch (error) {
            response = error instanceof HandlerError
                ? error.userMessage
                : handleError(error);
        }
        return isDebug
            ? JSON.stringify(response)
            : response;
    };

    function handleUnknownCommand({ originalRequest }) {
        const { command } = originalRequest;
        return `:trophy: This is not how you win a game... Try \`${command} help\`.`;
    }

    function handleUnknownCallback({ originalRequest }) {
        const { callback_id } = originalRequest;
        throw new HandlerError(`Missing handler for callback: ${callback_id}`);
    }

    function handleError(error) {
        const errorMessage = R.cond([
            [R.has('response'), ({ response }) => `${response.status} – ${JSON.stringify(response.data)}`],
            [R.is(Error), ({ message }) => message],
            [R.T, R.identity],
        ])(error);
        return new SlackTemplate(`:crying_cat_face: There was an error: \`${errorMessage}\`.`)
            .replaceOriginal(false)
            .get();
    }
}

module.exports = botFactory;
