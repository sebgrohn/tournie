const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { formatTimestamp, formatDescription, formatGameName } = require('./formatting');
const { organization } = require('./challonge');

const botFactory = challongeApi =>
    async function handleMessage(message) {
        const { type, text } = message;

        try {
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
        } catch (error) {
            return `Received error from Challonge API: ${error}`;
        }
    };

module.exports = botFactory;
