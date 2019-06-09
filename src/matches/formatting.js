const R = require('ramda');

const formatMatch = (match, currentUserEmailHash) =>
    `${formatParticipant(match.player1, currentUserEmailHash)} vs ${formatParticipant(match.player2, currentUserEmailHash)}`;

const formatParticipant = (participant, currentUserEmailHash) => participant
    ? participant.email_hash === currentUserEmailHash
        ? `*${participant.display_name}* (you)`
        : `*${participant.display_name}*`
    : ':grey_question:';

const formatScores = scoresCsv =>
    R.pipe(
        R.split(','),
        R.map(R.pipe(
            R.split('-'),
            R.join(':'),
        )),
        R.join(' '),
    )(scoresCsv);

module.exports = {
    formatMatch,
    formatScores,
};
