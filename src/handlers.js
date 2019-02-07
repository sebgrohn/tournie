const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { InvalidCallbackActionError } = require('./handlers.errors');
const { formatTimestamp, formatDescription, formatGameName, formatUser, formatMatch } = require('./formatting');
const { chain, concurrent, validateUser, validateCallbackValue, parseCallbackValue } = require('./handlers.utils');

const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['connect [<challonge_username>]', 'connect your Slack and Challonge accounts'],
    ['disconnect', 'disconnect your Slack and Challonge accounts'],
    ['next', 'list open matches in tournaments you are part of'],
    ['help', 'show this information'],
];

const unknownUserResponse = new SlackTemplate('I don\'t know who you are. :crying_cat_face:')
    .replaceOriginal(false)
    .get();

const listOpenTournaments = ({ challongeService, userRepository }) => async function ({ sender }) {
    const userPromise = userRepository.getUser(sender);
    const openTournamentsPromise = challongeService.fetchOpenTournaments();
    const [user, openTournaments] = [await userPromise, await openTournamentsPromise];

    return openTournaments.length === 0
        ? 'There are no open tournaments. Is it time to start one? :thinking_face:'
        : R.reduce(
            (response, t) => {
                response
                    .addAttachment('tournament')
                    .addTitle(t.name, t.full_challonge_url)
                    .addColor('#252830')
                    .addField('Tournament', `${formatGameName(t.game_name)} – ${t.tournament_type}`, true)
                    .addField('# Players', `${t.participants_count} / ${t.signup_cap}`, true);

                if (t.description) {
                    response.addText(formatDescription(t.description));
                }

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
};

const signUpUserCallback = chain(
    validateCallbackValue('sign_up'),
    concurrent(
        validateUser,
        ({ challongeService }) => async ({ callbackValue: tournamentId }) => {
            const tournament = await challongeService.fetchTournament(tournamentId);
            return tournament
                ? Promise.resolve({ tournament })
                : Promise.reject(new Error(`Tournament not found: ${tournamentId}`));
        },
    ),
    ({ challongeService }) => async function ({ user, callbackValue: tournamentId, tournament }) {
        await challongeService.addTournamentParticipant(tournamentId, user.challongeUsername);
        return new SlackTemplate(`Awesome! You are now signed up for tournament *${tournament.name}.* :tada:`)
            .replaceOriginal(false)
            .get();
    },
);

const showCurrentUser = ({ userRepository }) => async function ({ sender }) {
    const user = await userRepository.getUser(sender);
    if (!user) {
        return unknownUserResponse;
    }
    return `You are known as ${formatUser(user)}. :ok_hand:`;
};

const logInUser = ({ challongeService, userRepository }) => async function ({ text, sender }) {
    let user = await userRepository.getUser(sender);
    if (user) {
        return `You are already logged in as ${formatUser(user)}. :angry:`;
    }

    const challongeMembers = await challongeService.fetchMembers();
    
    const challongeUsername = text.split(/\s+/)[1];
    if (challongeUsername) {
        const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

        user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
        return `Congrats! You are now known as ${formatUser(user)}. :tada:`;
    }

    const response = new SlackTemplate()
        .addAttachment('login')
        .addText('Who are you? :simple_smile:')
        .addColor('#252830');
    response.getLatestAttachment().actions = [
        {
            type: 'select',
            text: 'Select...',
            name: 'username',
            options: R.map(({ username }) => ({
                text: username,
                value: username,
            }))(challongeMembers),
        },
    ];
    return response.get();
};

const logInUserCallback = ({ challongeService, userRepository }) => async function ({ sender, originalRequest }) {
    let user = await userRepository.getUser(sender);
    if (!user) {
        const challongeUsername = parseCallbackValue('username', originalRequest);
        if (!challongeUsername) {
            throw new InvalidCallbackActionError(originalRequest);
        }

        const challongeMembers = await challongeService.fetchMembers();
        const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

        user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
    }

    return new SlackTemplate()
        .addAttachment('login_verified')
        .addText(`Who are you? :simple_smile:\n\nCongrats! You are now known as ${formatUser(user)}. :tada:`)
        .addColor('#252830')
        .get();
};

const logOutUser = chain(
    validateUser,
    ({ userRepository }) => async function ({ sender }) {
        await userRepository.deleteUser(sender);
        return 'Okay, you are now forgotten. I hope to see you later! :wave:';
    },
);

const listNextMatches = ({ challongeService, userRepository }) => async function ({ sender }) {
    const user = await userRepository.getUser(sender);
    if (!user) {
        return unknownUserResponse;
    }

    const openMatches = await challongeService.fetchOpenMatchesForMember(user.challongeEmailHash);

    // TODO get users corresponding to opponents to show matching Slack nicks

    return openMatches.length === 0
        ? 'You have no matches to play. :sweat_smile:'
        : R.reduce(
            (response, m) => response
                .addAttachment('match')
                .addTitle(m.tournament.name, m.tournament.full_challonge_url)
                .addText(formatMatch(m, user.challongeEmailHash))
                .addColor('#252830')
                .addField('Tournament', `${formatGameName(m.tournament.game_name)} – ${m.tournament.tournament_type} (${m.tournament.progress_meter}%)`, true)
                .addField('Match opened', m.started_at ? formatTimestamp(m.started_at) : 'Pending opponent', true),
            new SlackTemplate('*:trophy: Your open matches: :trophy:*'),
        )(openMatches)
            .get();
};

const showUsage = () => function ({ originalRequest }) {
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
};

const closeUsageCallback = chain(
    validateCallbackValue('close'),
    () => () => ({ delete_original: true }), // NOTE SlackTemplate doesn't support this flag
);

module.exports = {
    listOpenTournaments,
    signUpUserCallback,
    showCurrentUser,
    logInUser,
    logInUserCallback,
    logOutUser,
    listNextMatches,
    showUsage,
    closeUsageCallback,
};
