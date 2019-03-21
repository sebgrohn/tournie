const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('./HandlerError');
const { chain, concurrent, validateUser, tryGetUser, validateCallbackValue } = require('./utils');
const { formatTimestamp, formatDescription, formatTournamentType, formatNumPlayers } = require('./formatting');

const listOpenTournaments = chain(
    tryGetUser,
    ({ challongeService }) => async ({ user }) => {
        const openTournaments = user
            ? await challongeService.fetchOpenTournamentsForMember(user.challongeEmailHash)
            : await challongeService.fetchOpenTournaments();
        return openTournaments.length > 0
            ? Promise.resolve({ user, openTournaments })
            : Promise.reject(new HandlerError('There are no open tournaments. Is it time to start one? :thinking_face:'));
    },
    () => ({ user, openTournaments }) =>
        R.reduce(
            (response, t) => {
                response
                    .addAttachment('tournament')
                    .addTitle(t.name, t.full_challonge_url)
                    .addColor('#252830')
                    .addField('Tournament', formatTournamentType(t.game_name, t.tournament_type), true)
                    .addField('# Players', formatNumPlayers(t.participants_count, t.signup_cap), true);

                if (t.description) {
                    response.addText(formatDescription(t.description));
                }

                if (t.started_at) {
                    response.addField('Started', formatTimestamp(t.started_at), true);
                } else {
                    response.addField('Created', formatTimestamp(t.created_at), true);
                }

                response.addField('State', `${t.state} (${t.progress_meter}%)`, true);

                if (user) {
                    if (t.is_signed_up) {
                        response.addField('Signed up', 'Yes', true);
                    } else {
                        response.addAction('Sign Up', 'sign_up', t.id);
                    }
                } else if (!t.started_at) {
                    response.addLinkButton('Sign Up', t.sign_up_url);
                }

                return response;
            },
            new SlackTemplate('*:trophy: Open tournaments: :trophy:*'),
        )(openTournaments)
            .get(),
);

const signUpUserFromListCallback = chain(
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
        return new SlackTemplate(`Awesome! You are now signed up for tournament *${tournament.name}.* :tada:`)
            .replaceOriginal(false)
            .get();
    },
);

module.exports = {
    listOpenTournaments,
    signUpUserFromListCallback,
};
