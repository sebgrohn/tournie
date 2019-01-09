const AWS = require('aws-sdk');
const R = require('ramda');

const userDomain = 'tournie-users';

function userRepositoryFactory({ region }) {
    const simpleDb = new AWS.SimpleDB({ region });

    const initialize = () =>
        // NOTE createDomain does nothing when the domain already exists
        simpleDb.createDomain({ DomainName: userDomain }).promise();

    async function getUser(slackUserId) {
        const { Attributes } = await simpleDb.getAttributes({
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
    }

    async function addUser(slackUserId, challongeUsername, challongeEmailHash = undefined) {
        const attributes = R.pipe(
            R.toPairs,
            R.map(([Name, Value]) => ({ Name, Value })),
            R.filter(({ Value }) => Value),
        )({ slackUserId, challongeUsername, challongeEmailHash });

        await simpleDb.putAttributes({
            DomainName: userDomain,
            ItemName: slackUserId,
            Attributes: attributes,
        }).promise();
    }

    const deleteUser = slackUserId =>
        simpleDb.deleteAttributes({
            DomainName: userDomain,
            ItemName: slackUserId,
        }).promise();

    return {
        initialize,
        getUser,
        addUser,
        deleteUser,
    };
}

module.exports = userRepositoryFactory;
