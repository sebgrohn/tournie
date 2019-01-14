const SlackTemplate = require('claudia-bot-builder').slackTemplate;

const defaultCommand = 'tournaments';

function botFactory(handlers) {
    const commandHandlers = {
        tournaments: handlers.listOpenTournaments,
        whoami: handlers.showCurrentUser,
        login: handlers.logInUser,
        logout: handlers.logOutUser,
        next: handlers.listNextMatches,
        help: handlers.showUsage,
        usage: handlers.showUsage,
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
            return await handleError(message, error);
        }
    }

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
};

module.exports = botFactory;
