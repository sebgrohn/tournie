const R = require('ramda');
const SlackTemplate = require('claudia-bot-builder').slackTemplate;
const { formatTimestamp, formatDescription, formatGameName } = require('./formatting');

const slashCommand = '/challonge';
const supportedCommands = [
    ['[tournaments]', 'list open tournaments'],
    ['whoami', 'show who you are on Challonge'],
    ['login <challonge_username>', 'connect your Slack and Challonge accounts'],
    ['logout', 'disconnect your Slack and Challonge accounts'],
    ['help|usage', 'show this information'],
];
const defaultCommand = 'tournaments';

function botFactory(challongeService, userRepository) {
    const { fetchOpenTournaments, fetchMembers } = challongeService;

    const commandHandlers = {
        tournaments: listTournaments,
        whoami: getCurrentUser,
        login: logInUser,
        logout: logOutUser,
        help: showUsage,
        usage: showUsage,
    };

    return async function handleMessage(message) {
        const { text } = message;
        const command = (text || defaultCommand).split(/\s+/)[0];

        try {
            const handleCommand = commandHandlers[command] || handleUnknown;
            return await handleCommand(message);
        } catch (error) {
            return await handleError(message, error);
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

    async function getCurrentUser({ sender }) {
        const user = await userRepository.getUser(sender);
        if (!user) {
            return 'I don\'t know who you are. :crying_cat_face:';
        }
        return `You are known as *${user.challongeUsername}* (${user.challongeEmailHash ? 'verified' : 'unverified'}). :ok_hand:`;
    }

    async function logInUser({ text, sender }) {
        const user = await userRepository.getUser(sender);
        if (user) {
            return `You are already logged in as *${user.challongeUsername}* (${user.challongeEmailHash ? 'verified' : 'unverified'}). :angry:`;
        }

        const challongeUsername = text.split(/\s+/)[1];
        if (!challongeUsername) {
            return 'Your need to specify a Challonge username. :nerd_face:';
        }

        const challongeMembers = await fetchMembers();
        const { email_hash: challongeEmailHash } = R.find(m => m.username === challongeUsername)(challongeMembers) || {};

        await userRepository.addUser(sender, challongeUsername, challongeEmailHash);
        return `Congrats! You are now known as *${challongeUsername}* (${challongeEmailHash ? 'verified' : 'unverified'}). :tada:`;
    }

    async function logOutUser({ sender }) {
        const user = await userRepository.getUser(sender);
        if (!user) {
            return 'I don\'t know who you are. :crying_cat_face:';
        }
        await userRepository.deleteUser(sender);
        return `Okay, you are now forgotten. I hope to see you later! :wave:`;
    }

    function showUsage(message) {
        const supportedCommandsString = R.pipe(
            R.map(([c, d]) => `• \`${slashCommand} ${c}\` to ${d}`),
            R.join('\n')
        )(supportedCommands);

        return new SlackTemplate()
            .addAttachment('usage')
            .addText(`Supported commands:\n${supportedCommandsString}`)
            .addColor('#252830')
            .get();
    }

    function handleUnknown(message) {
        return `:trophy: This is not how you win a game... Try \`${slashCommand} help\`.`;
    }

    function handleError(_, { response, message }) {
        const errorMessage = response
                && `${response.status} – ${JSON.stringify(response.data)}`
            || message;
        return `:crying_cat_face: There was an error: ${errorMessage}`;
    }
};

module.exports = botFactory;
