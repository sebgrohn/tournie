const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { formatTimestamp, formatDescription, formatGameName, formatMatch } = require('./formatting');

const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['login <challonge_username>', 'connect your Slack and Challonge accounts'],
    ['logout', 'disconnect your Slack and Challonge accounts'],
    ['next', 'list open matches in tournaments you are part of'],
    ['help|usage', 'show this information'],
];
const defaultCommand = 'tournaments';

function botFactory(challongeService, userRepository) {
    const { 
        fetchOpenTournaments,
        fetchMembers,
        fetchOpenMatchesForMember,
    } = challongeService;

    const commandHandlers = {
        tournaments: listOpenTournaments,
        whoami: showCurrentUser,
        login: logInUser,
        logout: logOutUser,
        next: listNextMatches,
        help: showUsage,
        usage: showUsage,
    };

    const callbackHandlers = {
        usage: closeUsageCallback,
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

    async function listOpenTournaments(message) {
        const openTournaments = await fetchOpenTournaments();

        return openTournaments.length === 0
            ? 'There are no open tournaments. Is it time to start one? :thinking_face:'
            : R.reduce(
                (response, t) => {
                    response
                        .addAttachment(`tournament-${t.subdomain}-${t.id}`)
                        .addTitle(t.name, t.full_challonge_url)
                        .addText(formatDescription(t.description))
                        .addColor('#252830')
                        .addField('Tournament', `${formatGameName(t.game_name)} – ${t.tournament_type}`, true)
                        .addField('# Players', `${t.participants_count} / ${t.signup_cap}`, true);

                    if (t.started_at) {
                        response.addField('Started', formatTimestamp(t.started_at), true);
                    } else {
                        response
                            .addField('Created', formatTimestamp(t.created_at), true)
                            .addLinkButton('Sign Up', t.sign_up_url);
                    }

                    return response.addField('State', `${t.state} (${t.progress_meter}%)`, true);
                },
                new SlackTemplate('*:trophy: Open tournaments: :trophy:*'),
            )(openTournaments)
                .get();
    }

    async function showCurrentUser({ sender }) {
        const user = await userRepository.getUser(sender);
        if (!user) {
            return 'I don\'t know who you are. :crying_cat_face:';
        }
        return `You are known as *${user.challongeUsername}* (${user.challongeEmailHash ? 'verified' : 'unverified'}). :ok_hand:`;
    }

    async function logInUser({ text, sender }) {
        const user = await userRepository.getUser(sender);
        if (user) {
            return `You are already logged in as *${user.challongeUsername}* (${user.challongeEmailHash ? 'verified' : 'unverified'}). :angry:`;
        }

        const challongeUsername = text.split(/\s+/)[1];
        if (!challongeUsername) {
            return 'You need to specify a Challonge username. :nerd_face:';
        }

        const challongeMembers = await fetchMembers();
        const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

        await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
        return `Congrats! You are now known as *${challongeUsername}* (${challongeEmailHash ? 'verified' : 'unverified'}). :tada:`;
    }

    async function logOutUser({ sender }) {
        const user = await userRepository.getUser(sender);
        if (!user) {
            return 'I don\'t know who you are. :crying_cat_face:';
        }
        await userRepository.deleteUser(sender);
        return `Okay, you are now forgotten. I hope to see you later! :wave:`;
    }

    async function listNextMatches({ sender }) {
        const user = await userRepository.getUser(sender);
        if (!user) {
            return 'I don\'t know who you are. :crying_cat_face:';
        }

        const openMatches = await fetchOpenMatchesForMember(user.challongeEmailHash);

        // TODO get users corresponding to opponents to show matching Slack nicks

        return openMatches.length === 0
            ? 'You have no matches to play. :sweat_smile:'
            : R.reduce(
                (response, m) => response
                    .addAttachment(`match-${m.id}`)
                    .addTitle(m.tournament.name, m.tournament.full_challonge_url)
                    .addText(formatMatch(m, user.challongeEmailHash))
                    .addColor('#252830')
                    .addField('Tournament', `${formatGameName(m.tournament.game_name)} – ${m.tournament.tournament_type} (${m.tournament.progress_meter}%)`, true)
                    .addField('Match opened', m.started_at ? formatTimestamp(m.started_at) : 'Pending opponent', true),
                new SlackTemplate('*:trophy: Your open matches: :trophy:*'),
            )(openMatches)
                .get();
    }

    function showUsage({ originalRequest }) {
        const { command } = originalRequest;
        const supportedCommandsString = R.pipe(
            R.map(([c, d]) => `• \`${command} ${c}\` to ${d}`),
            R.join('\n'),
        )(supportedCommands);

        return new SlackTemplate()
            .addAttachment('usage')
            .addText(`Supported commands:\n${supportedCommandsString}`)
            .addColor('#252830')
            .addAction('Close', 'close', 'close')
            .get();
    }

    function closeUsageCallback({ originalRequest }) {
        const { actions, callback_id } = originalRequest;
        const shouldClose = R.any(({ name }) => name === 'close')(actions);
        if (!shouldClose) {
            throw new Error(`Invalid action value(s) for callback: ${callback_id}`);
        }
        return { delete_original: true }; // NOTE SlackTemplate doesn't support this flag
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
