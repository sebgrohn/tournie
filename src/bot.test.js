const botFactory = require('./bot');

test('handleUnknownCallback', async () => {
    const bot = botFactory({});
    const message = {
        text: '',
        originalRequest: {
            callback_id: 'someUnknownCallback',
        },
    };
    const res = await bot(message);
    expect(res).toHaveProperty('text');
    const { text } = res;
    expect(text)
        .toBe(':crying_cat_face: There was an error: `Missing handler for callback: someUnknownCallback`.');
});

test('handleUnknownCommand', async () => {
    const bot = botFactory({});
    const message = {
        text: 'someUnknownCommand',
        originalRequest: {
            callback_id: undefined,
        },
    };
    const res = await bot(message);
    expect(res).toBe(':trophy: This is not how you win a game... Try `undefined help`.');
});

test('whoami', async () => {
    const mockFn = jest.fn();
    const handlers = {
        showCurrentUser: async () => mockFn(),
    };
    const bot = botFactory(handlers);
    const message = {
        text: 'whoami',
        originalRequest: {
            callback_id: undefined,
        },
    };
    await bot(message);
    expect(mockFn.mock.calls.length).toBe(1);
});
