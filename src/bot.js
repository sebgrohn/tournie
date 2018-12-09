const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { formatTimestamp, formatDescription, formatGameName } = require('./formatting');

const slashCommand = '/challonge';
const supportedCommands = [
    ['[list]', 'list open tournaments'],
    ['help|usage', 'show this information'],
];

function botFactory(challongeService, userRepository) {
    const { fetchOpenTournaments } = challongeService;

    return async function handleMessage(message) {
        const { text } = message;
        const command = text || 'list';

        try {
            switch (command) {
                case 'list':
                    return await listTournaments(message);

                case 'help':
                case 'usage':
                    return await usage(message);

                default:
                    return await usage(message, true);
            }
        } catch (error) {
            return handleError(message, error);
        }
    }

    async function listTournaments(message) {
        const openTournaments = await fetchOpenTournaments();

        return R.reduce(
            (response, t) => {
                response
                    .addAttachment(`tournament-${t.subdomain}-${t.id}`)
                    .addTitle(t.name, t.full_challonge_url)
                    .addText(formatDescription(t.description))
                    .addColor('#252830')
                    .addField('Tournament', `${formatGameName(t.game_name)} – ${t.tournament_type}`, true)
                    .addField('# Players', `${t.participants_count} / ${t.signup_cap}`, true);

                if (t.started_at) {
                    response.addField('Started', formatTimestamp(t.started_at), true);
                } else {
                    response
                        .addField('Created', formatTimestamp(t.created_at), true)
                        .addLinkButton('Sign Up', t.sign_up_url);
                }

                return response.addField('State', `${t.state} (${t.progress_meter}%)`, true);
            },
            new SlackTemplate('*:trophy: Open tournaments: :trophy:*'),
        )(openTournaments)
            .get();
    }

    async function usage(message, invalidCommand) {
        const supportedCommandsString = R.pipe(
            R.map(([c, d]) => `• \`${slashCommand} ${c}\` to ${d}`),
            R.join('\n')
        )(supportedCommands);

        return new SlackTemplate(invalidCommand ? ':trophy: This is not how you win a game...' : undefined)
            .addAttachment('usage')
            .addText(`Supported commands:\n${supportedCommandsString}`)
            .addColor('#252830')
            .get();
    }

    function handleError(_, { response, message }) {
        const errorMessage = response
                && `${response.status} – ${JSON.stringify(response.data)}`
            || message;
        return `:crying_cat_face: There was an error: ${errorMessage}`;
    }
};

module.exports = botFactory;
