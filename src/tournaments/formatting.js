const slackify = require('slackify-html');
const { formatGameName } = require('../formatting');

const formatDescription = description =>
    slackify(description.replace(/<\s*br\s*\/?\s*>/, '\n'));

const formatTournamentType = (gameName, tournamentType) => `${formatGameName(gameName)} – ${tournamentType}`;

const formatNumPlayers = (participantsCount, signupCap) => signupCap
    ? `${participantsCount} / ${signupCap}`
    : `${participantsCount}`;

module.exports = {
    formatDescription,
    formatTournamentType,
    formatNumPlayers,
};
