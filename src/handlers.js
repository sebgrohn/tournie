const R = require('ramda');
const S = require('sanctuary');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { chain, concurrent, validateUser, validateCallbackValue } = require('./handlers.utils');
const { formatTimestamp, formatDescription, formatGameName, formatUser, formatMatch } = require('./formatting');

const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['connect [<challonge_username>]', 'connect your Slack and Challonge accounts'],
    ['disconnect', 'disconnect your Slack and Challonge accounts'],
    ['signup', 'sign up for a tournament'],
    ['next', 'list open matches in tournaments you are part of'],
    ['help', 'show this information'],
];

const listOpenTournaments = ({ challongeService, userRepository }) => async ({ sender }) => {
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
                ? S.Right({ tournament })
                : S.Left(`Tournament not found: ${tournamentId}`);
        },
    ),
    ({ challongeService }) => async ({ user, callbackValue: tournamentId, tournament }) => {
        await challongeService.addTournamentParticipant(tournamentId, user.challongeUsername);
        return S.Right(
            new SlackTemplate(`Awesome! You are now signed up for tournament *${tournament.name}.* :tada:`)
                .replaceOriginal(false)
                .get(),
        );
    },
);

const showCurrentUser = chain(
    validateUser,
    () => ({ user }) => S.Right(`You are known as ${formatUser(user)}. :ok_hand:`),
);

const logInUser = ({ challongeService, userRepository }) => async ({ text, sender }) => {
    let user = await userRepository.getUser(sender);
    if (user) {
        return S.Right(`You are already logged in as ${formatUser(user)}. :angry:`);
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
    return S.Right(response.get());
};

const logInUserCallback = chain(
    validateCallbackValue('username'),
    ({ challongeService, userRepository }) => async ({ sender, callbackValue: challongeUsername }) => {
        let user = await userRepository.getUser(sender);
        if (!user) {
            const challongeMembers = await challongeService.fetchMembers();
            const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

            user = await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
        }

        return S.Right(new SlackTemplate()
            .addAttachment('login_verified')
            .addText(`Who are you? :simple_smile:\n\nCongrats! You are now known as ${formatUser(user)}. :tada:`)
            .addColor('#252830')
            .get(),
        );
    },
);

const logOutUser = chain(
    validateUser,
    ({ userRepository }) => async ({ sender }) => {
        await userRepository.deleteUser(sender);
        return S.Right('Okay, you are now forgotten. I hope to see you later! :wave:');
    },
);

const signUpUser = chain(
    validateUser,
    ({ challongeService }) => async ({ user }) => {
        const notSignedUpTournaments = await challongeService.fetchTournamentsForMember(user.challongeEmailHash, false);
        return notSignedUpTournaments.length > 0
            ? S.Right(notSignedUpTournaments)
            : S.Left('There are currently no tournaments where you can sign up.');
    },
    () => async notSignedUpTournaments => {
        const response = new SlackTemplate()
            .addAttachment('signup')
            .addText('What tournament do you want to join? :simple_smile:')
            .addColor('#252830');
        response.getLatestAttachment().actions = [
            {
                type: 'select',
                text: 'Select...',
                name: 'sign_up',
                options: R.map(({ id, name }) => ({
                    text: name,
                    value: id,
                }))(notSignedUpTournaments),
            },
        ];
        return S.Right(response.get());
    },
);

const listNextMatches = chain(
    validateUser,
    ({ challongeService }) => async ({ user }) => {
        const openMatches = await challongeService.fetchOpenMatchesForMember(user.challongeEmailHash);

        // TODO get users corresponding to opponents to show matching Slack nicks

        return S.Right(openMatches.length === 0
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
                .get(),
        );
    },
);

const showUsage = () => ({ originalRequest }) => {
    const { command } = originalRequest;
    const supportedCommandsString = R.pipe(
        R.map(([c, d]) => `• \`${command} ${c}\` to ${d}`),
        R.join('\n'),
    )(supportedCommands);

    return S.Right(new SlackTemplate()
        .addAttachment('usage')
        .addText(`Supported commands:\n${supportedCommandsString}`)
        .addColor('#252830')
        .addAction('Close', 'close', 'close')
        .get());
};

const closeUsageCallback = chain(
    validateCallbackValue('close'),
    () => () => S.Right({ delete_original: true }), // NOTE SlackTemplate doesn't support the delete_original flag
);

module.exports = {
    listOpenTournaments,
    signUpUserCallback,
    showCurrentUser,
    logInUser,
    logInUserCallback,
    logOutUser,
    signUpUser,
    listNextMatches,
    showUsage,
    closeUsageCallback,
};
