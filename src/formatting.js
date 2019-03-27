
// TODO implement
const formatTimestamp = isoTimestampString => isoTimestampString;

function formatGameName(gameName) {
    switch (gameName.toLowerCase()) {
        case 'table tennis':
            return ':table_tennis_paddle_and_ball:';
        case 'klask':
            return ':klask:';
        default:
            return gameName;
    }
}

const formatUser = ({ challongeUsername, challongeEmailHash }) => `*${challongeUsername}* (${challongeEmailHash ? 'verified' : 'unverified'})`;

module.exports = {
    formatTimestamp,
    formatGameName,
    formatUser,
};
