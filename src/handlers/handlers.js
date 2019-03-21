const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('./HandlerError');
const { chain, concurrent, validateUser, validateCallbackValue } = require('./utils');
const { formatTimestamp, formatGameName, formatMatch } = require('./formatting');

const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['connect [<challonge_username>]', 'connect your Slack and Challonge accounts'],
    ['disconnect', 'disconnect your Slack and Challonge accounts'],
    ['signup', 'sign up for a tournament'],
    ['next', 'list open matches in tournaments you are part of'],
    ['help', 'show this information'],
];

const signUpUser = chain(
    validateUser,
    ({ challongeService }) => async ({ user }) => {
        const notSignedUpTournaments = await challongeService.fetchOpenTournamentsForMember(user.challongeEmailHash, { signedUpFilter: false, includeUnderway: false });
        return notSignedUpTournaments.length > 0
            ? Promise.resolve(notSignedUpTournaments)
            : Promise.reject(new HandlerError('There are currently no tournaments where you can sign up.'));
    },
    () => notSignedUpTournaments => {
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
        return response.get();
    },
);

const signUpUserCallback = chain(
    validateCallbackValue('sign_up', 'tournamentId'),
    concurrent(
        validateUser,
        ({ challongeService }) => async ({ tournamentId }) => {
            const tournament = await challongeService.fetchTournament(tournamentId);
            return tournament
                ? Promise.resolve({ tournament })
                : Promise.reject(new HandlerError(`Tournament not found: ${tournamentId}`));
        },
    ),
    ({ challongeService }) => async ({ user, tournamentId, tournament }) => {
        await challongeService.addTournamentParticipant(tournamentId, user.challongeUsername);
        return new SlackTemplate()
            .addAttachment('signup')
            .addText(`What tournament do you want to join? :simple_smile:\n\nAwesome! You are now signed up for tournament *${tournament.name}.* :tada:`)
            .addColor('#252830')
            .get();
    },
);

const listNextMatches = chain(
    validateUser,
    ({ challongeService }) => async ({ user }) => {
        const openMatches = await challongeService.fetchOpenMatchesForMember(user.challongeEmailHash);
        return openMatches.length > 0
            ? Promise.resolve({ openMatches })
            : Promise.reject(new HandlerError('You have no matches to play. :sweat_smile:'));
    },
    () => ({ user, openMatches }) =>
        R.reduce(
            (response, m) => response
                .addAttachment('match')
                // TODO get users corresponding to opponents to show matching Slack nicks
                .addTitle(m.tournament.name, m.tournament.full_challonge_url)
                .addText(formatMatch(m, user.challongeEmailHash))
                .addColor('#252830')
                .addField('Tournament', `${formatGameName(m.tournament.game_name)} – ${m.tournament.tournament_type} (${m.tournament.progress_meter}%)`, true)
                .addField('Match opened', m.started_at ? formatTimestamp(m.started_at) : 'Pending opponent', true),
            new SlackTemplate('*:trophy: Your open matches: :trophy:*'),
        )(openMatches)
            .get(),
);

const showUsage = () => ({ originalRequest }) => {
    const { command } = originalRequest;
    const supportedCommandsString = R.pipe(
        R.map(([c, d]) => `• \`${command} ${c}\` to ${d}`),
        R.join('\n'),
    )(supportedCommands);

    return new SlackTemplate()
        .addAttachment('usage')
        .addText(`*Supported commands:*\n${supportedCommandsString}`)
        .addColor('#252830')
        .addAction('Close', 'close', 'close')
        .get();
};

const closeUsageCallback = chain(
    validateCallbackValue('close'),
    () => () => ({ delete_original: true }), // NOTE SlackTemplate doesn't support this flag
);

module.exports = {
    signUpUser,
    signUpUserCallback,
    listNextMatches,
    showUsage,
    closeUsageCallback,
};
