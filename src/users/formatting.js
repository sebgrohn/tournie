
const formatUser = ({ challongeUsername, challongeEmailHash }) => `*${challongeUsername}* (${challongeEmailHash ? 'verified' : 'unverified'})`;

module.exports = {
    formatUser,
};
