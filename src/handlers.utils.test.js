const S = require('sanctuary');
const { chain, concurrent } = require('./handlers.utils');

const deps = { service: () => 1 };

describe('chain', () => {
    test('should process all Right resolving', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            ({ service }) => m => Promise.resolve(S.Right({ ...m, user: `user${service()}` })),
            () => ({ text, user }) => Promise.resolve(S.Right(`${user} wrote: ${text}.`)),
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(responseMessage).toEqual(S.Right('user1 wrote: hello.'));
    });

    test('should go Left if one goes Left', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            () => m => Promise.resolve(S.Right({ ...m, user: 'user0' })),
            () => () => Promise.resolve(S.Left('Invalid message')),
            () => ({ text, user }) => Promise.resolve(S.Right(`${user} wrote: ${text}.`)),
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(responseMessage).toEqual(S.Left('Invalid message'));
    });

    test('should reject if one rejects', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            () => m => Promise.resolve(S.Right({ ...m, user: 'user0' })),
            () => () => Promise.reject(new Error('Strange error')),
            () => ({ text, user }) => Promise.resolve(S.Right(`${user} wrote: ${text}.`)),
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Strange error'));
    });

    test('should handle synchronous', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            () => m => S.Right({ ...m, valid: true }),
            ({ service }) => m => Promise.resolve(S.Right({ ...m, user: `user${service()}` })),
            () => ({ text, valid, user }) => valid ? S.Right(`${user} wrote: ${text}.`) : S.Left('Invalid'),
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(responseMessage).toEqual(S.Right('user1 wrote: hello.'));
    });
});

describe('concurrent', () => {
    test('should process all Right resolving', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => Promise.resolve(S.Right({ ...m, valid: true })),
            ({ service }) => m => Promise.resolve(S.Right({ ...m, user: `user${service()}` })),
        );

        const message = await handlerFactory(deps)(requestMessage);
        
        expect.assertions(1);
        expect(message).toEqual(S.Right({ 
            text: 'hello',
            valid: true,
            user: 'user1',
        }));
    });

    test('should go Left if one goes Left', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => () => Promise.resolve(S.Left('Invalid message')),
            () => m => Promise.resolve(S.Right({ ...m, user: 'user0' })),
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessage).toEqual(S.Left('Invalid message'));
    });

    test('should reject if one rejects', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => () => Promise.reject(new Error('Strange error')),
            () => m => Promise.resolve(S.Right({ ...m, user: 'user0' })),
        );

        const responseMessagePromise = handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        await expect(responseMessagePromise).rejects.toEqual(new Error('Strange error'));
    });

    test('should handle synchronous', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => S.Right({ ...m, valid: true }),
            ({ service }) => m => Promise.resolve(S.Right({ ...m, user: `user${service()}` })),
        );

        const message = await handlerFactory(deps)(requestMessage);
        
        expect.assertions(1);
        expect(message).toEqual(S.Right({ 
            text: 'hello',
            valid: true,
            user: 'user1',
        }));
    });

    test('should take last value for duplicate keys', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => Promise.resolve(S.Right({ ...m, user: 'first user' })),
            () => m => Promise.resolve(S.Right({ ...m, user: 'right user' })),
        );

        const message = await handlerFactory(deps)(requestMessage);
        
        expect.assertions(1);
        expect(message).toEqual(S.Right({
            text: 'hello',
            user: 'right user',
        }));
    });
});
