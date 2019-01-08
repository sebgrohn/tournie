const R = require('ramda');

const userDomain = 'tournie-users';

const userRepository = {
    initialize: db => () =>
        // NOTE createDomain does nothing when the domain already exists
        db.createDomain({ DomainName: userDomain }).promise(),
    getUser: db => async function(slackUserId) {
        const { Attributes } = await db.getAttributes({
            DomainName: userDomain,
            ItemName: slackUserId,
            AttributeNames: ['slackUserId', 'challongeUsername', 'challongeEmailHash'],
        }).promise();

        if (!Attributes) {
            return undefined;
        }

        return R.pipe(
            R.map(({ Name, Value }) => [Name, Value]),
            R.fromPairs,
        )(Attributes);
    },
    addUser: db => async function(slackUserId, challongeUsername, challongeEmailHash = undefined) {
        const user = { slackUserId, challongeUsername, challongeEmailHash };
        const attributes = R.pipe(
            R.toPairs,
            R.map(([Name, Value]) => ({ Name, Value })),
            R.filter(({ Value }) => Value),
        )(user);

        await db.putAttributes({
            DomainName: userDomain,
            ItemName: slackUserId,
            Attributes: attributes,
        }).promise();

        return user;
    },
    deleteUser: db => slackUserId =>
        db.deleteAttributes({
            DomainName: userDomain,
            ItemName: slackUserId,
        }).promise()
}

module.exports = userRepository;
