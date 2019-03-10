const { chain, concurrent } = require('./utils');

const deps = { service: () => 1 };

describe('chain', () => {
    test('should process all resolving', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => ({ text, user }) => Promise.resolve(`${user} wrote: ${text}.`),
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(responseMessage).toEqual('user1 wrote: hello.');
    });

    test('should reject if one rejects', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            () => m => Promise.resolve({ ...m, user: 'user0' }),
            () => () => Promise.reject(new Error('Invalid message')),
            () => ({ text, user }) => Promise.resolve(`${user} wrote: ${text}.`),
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Invalid message'));
    });

    test('should handle synchronous', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            () => m => ({ ...m, valid: true }),
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => ({ text, valid, user }) => valid ? `${user} wrote: ${text}.` : 'Invalid',
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(responseMessage).toEqual('user1 wrote: hello.');
    });

    test('should reject if first one throws synchronously', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            () => () => { throw new Error('Unknown error'); },
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => ({ text, valid, user }) => valid ? `${user} wrote: ${text}.` : 'Invalid',
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Unknown error'));
    });

    test('should reject if other one throws synchronously', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => () => { throw new Error('Unknown error'); },
            () => ({ text, valid, user }) => valid ? `${user} wrote: ${text}.` : 'Invalid',
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Unknown error'));
    });
});

describe('concurrent', () => {
    test('should process all resolving', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => Promise.resolve({ ...m, valid: true }),
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
        );

        const message = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(message).toEqual({
            text: 'hello',
            valid: true,
            user: 'user1',
        });
    });

    test('should take last value for duplicate keys', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => Promise.resolve({ ...m, user: 'first user' }),
            () => m => Promise.resolve({ ...m, user: 'right user' }),
        );

        const message = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(message).toEqual({
            text: 'hello',
            user: 'right user',
        });
    });

    test('should reject if one rejects', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => () => Promise.reject(new Error('Invalid message')),
            () => m => Promise.resolve({ ...m, user: 'user0' }),
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Invalid message'));
    });

    test('should handle synchronous', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => ({ ...m, valid: true }),
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => m => ({ ...m, awesome: 'always' }),
        );

        const message = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(message).toEqual({
            text: 'hello',
            valid: true,
            user: 'user1',
            awesome: 'always',
        });
    });

    test('should reject if one throws synchronously', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => () => { throw new Error('Unknown error'); },
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => ({ text, valid, user }) => valid ? `${user} wrote: ${text}.` : 'Invalid',
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Unknown error'));
    });
});
