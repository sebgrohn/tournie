const slackify = require('slackify-html');

// TODO implement
const formatTimestamp = isoTimestampString => isoTimestampString;

const formatDescription = description =>
    slackify(description.replace(/<\s*br\s*\/?\s*>/, '\n'));

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

module.exports = {
    formatTimestamp,
    formatDescription,
    formatGameName,
};
