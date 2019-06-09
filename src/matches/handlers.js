const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const HandlerError = require('../HandlerError');
const { chain } = require('../handlers.utils');
const { validateUser } = require('../users').validation;
const { validateCallbackValue } = require('../callback.validation');
const { formatTimestamp, formatGameName } = require('../formatting');
const { formatMatch, formatScores } = require('./formatting');

const fetchOpenMatches = ({ challongeService }) => async message => {
    const { user } = message;
    const openMatches = await challongeService.fetchOpenMatchesForMember(user.challongeEmailHash);
    return openMatches.length > 0
        ? Promise.resolve({ ...message, openMatches })
        : Promise.reject(new HandlerError('You have no matches to play. :sweat_smile:'));
};

const listNextMatches = chain(
    validateUser,
    fetchOpenMatches,
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

const reportMatchScores = chain(
    validateUser,
    fetchOpenMatches,
    ({ challongeService }) => async ({ text, user, openMatches }) => {
        const scores = R.pipe(
            R.split(/\s+/),
            R.slice(1, Infinity),
            R.map(R.pipe(
                R.split(/[:-]/),
                R.map(Number.parseInt),
            )),
        )(text);
        if (scores.length > 1) {
            const match = openMatches[0];
            const updatedMatch = await challongeService.reportMatchScores(match, scores);
            return `Reported scores on ${formatMatch(match, user.challongeEmailHash)} (${match.tournament.name}): ${formatScores(updatedMatch.scores_csv)}`;
        }

        if (openMatches.length > 1) {
            const response = new SlackTemplate()
                .addAttachment('report')
                .addText('What match do you want to report? :simple_smile:')
                .addColor('#252830');
            response.getLatestAttachment().actions = [
                {
                    type: 'select',
                    text: 'Select...',
                    name: 'report_scores',
                    options: R.map(m => ({
                        text: `${m.tournament.name} – ${formatMatch(m, user.challongeEmailHash)}`,
                        value: m.id,
                    }))(openMatches),
                },
            ];
            return response.get();
        }
    },
);

const reportMatchScoresCallback = chain(
    validateCallbackValue('report_scores', 'matchId'),
    validateUser,
);

module.exports = {
    listNextMatches,
    reportMatchScores,
    reportMatchScoresCallback,
};
