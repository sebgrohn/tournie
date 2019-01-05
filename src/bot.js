const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { formatTimestamp, formatDescription, formatGameName, formatMatch } = require('./formatting');

const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['login [<challonge_username>]', 'connect your Slack and Challonge accounts'],
    ['logout', 'disconnect your Slack and Challonge accounts'],
    ['next', 'list open matches in tournaments you are part of'],
    ['help|usage', 'show this information'],
];
const defaultCommand = 'tournaments';

function botFactory(challongeService, userRepository) {
    const { 
        fetchOpenTournaments,
        fetchTournament,
        fetchMembers,
        fetchOpenMatchesForMember,
        addTournamentParticipant,
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
        tournament: signUpUserCallback,
        login: logInUserCallback,
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

    async function listOpenTournaments({ sender }) {
        const userPromise = userRepository.getUser(sender);
        const openTournamentsPromise = fetchOpenTournaments();
        const [user, openTournaments] = [await userPromise, await openTournamentsPromise];

        return openTournaments.length === 0
            ? 'There are no open tournaments. Is it time to start one? :thinking_face:'
            : R.reduce(
                (response, t) => {
                    response
                        .addAttachment(`tournament`)
                        .addTitle(t.name, t.full_challonge_url)
                        .addText(formatDescription(t.description))
                        .addColor('#252830')
                        .addField('Tournament', `${formatGameName(t.game_name)} – ${t.tournament_type}`, true)
                        .addField('# Players', `${t.participants_count} / ${t.signup_cap}`, true);

                    if (t.started_at) {
                        response.addField('Started', formatTimestamp(t.started_at), true);
                    } else {
                        response.addField('Created', formatTimestamp(t.created_at), true);
                        if (user) {
                            response.addAction('Sign Up', 'sign_up', t.id);
                        } else {
                            response.addLinkButton('Sign Up', t.sign_up_url);
                        }
                    }

                    return response.addField('State', `${t.state} (${t.progress_meter}%)`, true);
                },
                new SlackTemplate('*:trophy: Open tournaments: :trophy:*'),
            )(openTournaments)
                .get();
    }

    async function signUpUserCallback({ sender, originalRequest }) {
        const user = await userRepository.getUser(sender);
        if (!user) {
            return 'I don\'t know who you are. :crying_cat_face:';
        }

        const { actions, callback_id } = originalRequest;
        const { value: tournamentId } = R.find(({ name }) => name === 'sign_up')(actions);

        if (!tournamentId) {
            throw new Error(`Invalid action value(s) for callback: ${callback_id}`);
        }

        const tournamentPromise = fetchTournament(tournamentId);
        const addParticipantPromise = addTournamentParticipant(tournamentId, user.challongeUsername);
        const [tournament] = [await tournamentPromise, await addParticipantPromise];
        return new SlackTemplate(`Awesome! You are now signed up for tournament *${tournament.name}.* :tada:`)
            .replaceOriginal(false)
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
        let user = await userRepository.getUser(sender);
        if (user) {
            return `You are already logged in as *${user.challongeUsername}* (${user.challongeEmailHash ? 'verified' : 'unverified'}). :angry:`;
        }

        const challongeUsername = text.split(/\s+/)[1];
        if (challongeUsername) {
            const challongeMembers = await fetchMembers();
            const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

            user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
        }

        const challongeMembers = await fetchMembers();
        const response = new SlackTemplate()
            .addAttachment('login')
            .addText('Who are you? :simple_smile:')
            .addColor('#252830');
        response.getLatestAttachment().actions = [
            {
                type: 'select',
                text: 'Select...',
                name: 'username',
                options: R.map(m => ({
                    text: m.username,
                    value: m.username,
                }))(challongeMembers),
            },
        ];
        return response.get();
    }

    async function logInUserCallback({ sender, originalRequest }) {
        let user = await userRepository.getUser(sender);
        if (!user) {
            const { actions, callback_id } = originalRequest;
            const { value: challongeUsername } = R.pipe(
                R.filter(({ name }) => name === 'username'),
                R.map(({ selected_options }) => selected_options),
                R.unnest,
                R.find(() => true),
            )(actions) || {};

            if (!challongeUsername) {
                throw new Error(`Invalid action value(s) for callback: ${callback_id}`);
            }

            const challongeMembers = await fetchMembers();
            const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

            user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
        }

        return new SlackTemplate()
            .addAttachment('login_verified')
            .addText(`Who are you? :simple_smile:\n\nCongrats! You are now known as *${user.challongeUsername}* (${user.challongeEmailHash ? 'verified' : 'unverified'}). :tada:`)
            .addColor('#252830')
            .get();
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
                    .addAttachment(`match`)
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
