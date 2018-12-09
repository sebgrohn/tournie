const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { formatTimestamp, formatDescription, formatGameName } = require('./formatting');
const { organization } = require('../challonge');

function botFactory(challongeApi) {
    return async function handleMessage(message) {
        const { type, text } = message;
        const command = text || 'list';

        try {
            switch (command) {
                case 'list':
                    return await listTournaments(message);

                case 'help':
                case 'usage':
                default:
                    return await usage(message);
            }
        } catch (error) {
            return handleError(message, error);
        }
    }

    async function listTournaments({ type }) {
        const { data } = await challongeApi.get('tournaments.json', {
            params: {
                subdomain: organization,
                // state: '...', // one of 'all', 'pending', 'in_progress', 'ended'
            },
        });

        const openTournaments = R.pipe(
            R.map(({ tournament }) => tournament),
            R.filter(t => ['pending', 'underway'].includes(t.state)),
        )(data);

        if (type === 'slack-slash-command') {
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
        } else {
            return `Open tournaments:\n${JSON.stringify(openTournaments)}`;
        }
    }

    async function usage({ type }) {
        if (type === 'slack-slash-command') {
            return new SlackTemplate(':trophy: This is not how you win a game...')
                .addAttachment('usage')
                .addText('Supported commands:\n• `/challonge [list]` to list open tournaments\n• `/challonge help|usage` to show this information')
                .addColor('#252830')
                .get();
        } else {
            return 'Supported commands:\n* /challonge [list] to list open tournaments\n* /challonge help|usage to show this information';
        }
    }

    function handleError({ type }, { response, request, message }) {
        const errorMessage = response
                && `${response.status} – ${JSON.stringify(response.data)}` 
            || message;

        if (type === 'slack-slash-command') {
            return new SlackTemplate(`Received error from Challonge API: :crying_cat_face:\n${errorMessage}`).get();
        } else {
            return `Received error from Challonge API: ${errorMessage}`;
        }
    }
};

module.exports = botFactory;
