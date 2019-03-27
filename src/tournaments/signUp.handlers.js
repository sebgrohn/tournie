const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('../HandlerError');
const { chain, concurrent, validateUser, validateCallbackValue } = require('../handlers.utils');

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

module.exports = {
    signUpUser,
    signUpUserCallback,
};
