const userRepo = require('./user.repository');

test('getUser', async () => {
    const mockFn = jest.fn();
    const userInDb = {
        Attributes: [
            { Name: 'slackUserId', Value: 1 },
            { Name: 'challongeUsername', Value: 2 },
            { Name: 'challongeEmailHash', Value: 3 },
        ],
    };
    const fakeDb = {
        getAttributes: attributes => ({
            promise: async () => {
                mockFn(attributes);
                return userInDb;
            },
        }),
    };
    const slackUserId = 'the user id';
    const user = await userRepo.getUser(fakeDb)(slackUserId);

    expect(mockFn.mock.calls.length).toBe(1);
    expect(mockFn.mock.calls[0][0]).toEqual({
        DomainName: 'challonge-bot-users',
        ItemName: 'the user id',
        AttributeNames: ['slackUserId', 'challongeUsername', 'challongeEmailHash'],
    });
    expect(user).toEqual({
        challongeEmailHash: 3,
        challongeUsername: 2,
        slackUserId: 1,
    });
});

test('addUser', async () => {
    const mockFn = jest.fn();
    const fakeDb = {
        putAttributes: attributes => ({
            promise: async () => mockFn(attributes),
        }),
    };
    const slackUserId = 'the user id';
    const challongeUsername = 'the username';
    const user = await userRepo.addUser(fakeDb)(slackUserId, challongeUsername);

    expect(mockFn.mock.calls.length).toBe(1);
    expect(mockFn.mock.calls[0][0]).toEqual({
        DomainName: 'challonge-bot-users',
        ItemName: 'the user id',
        Attributes: [
            { Name: 'slackUserId', Value: 'the user id' },
            { Name: 'challongeUsername', Value: 'the username' },
        ],
    });
    expect(user).toEqual({
        challongeEmailHash: undefined,
        challongeUsername: 'the username',
        slackUserId: 'the user id',
    });
});
