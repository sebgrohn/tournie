const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('./HandlerError');
const { chain, validateUser } = require('./utils');
const { formatTimestamp, formatGameName, formatMatch } = require('./formatting');

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

module.exports = {
    listNextMatches,
};
