
const formatMatch = (match, currentUserEmailHash) =>
    `${formatParticipant(match.player1, currentUserEmailHash)} vs ${formatParticipant(match.player2, currentUserEmailHash)}`;

const formatParticipant = (participant, currentUserEmailHash) => participant
    ? participant.email_hash === currentUserEmailHash
        ? `*${participant.display_name}* (you)`
        : `*${participant.display_name}*`
    : ':grey_question:';

module.exports = {
    formatMatch,
};
