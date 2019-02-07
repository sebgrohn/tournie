const { chain, concurrent } = require('./handlers.utils');

const deps = { service: () => 1 };

describe('chain', () => {
    test('should process all resolving sequentially', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = chain(
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
            () => ({ text, user }) => Promise.resolve(`${user} wrote: ${text}.`),
        );

        const responseMessage = await handlerFactory(deps)(requestMessage);

        expect.assertions(1);
        expect(responseMessage).toEqual('user1 wrote: hello.');
    });

    test('should process until rejecting sequentially', async () => {
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
});

describe('concurrent', () => {
    test('should process concurrently', async () => {
        const requestMessage = { text: 'hello' };
        const handlerFactory = concurrent(
            () => m => Promise.resolve({ ...m, valid: true }),
            ({ service }) => m => Promise.resolve({ ...m, user: `user${service()}` }),
        );

        const message = await handlerFactory(deps)(requestMessage);
        
        expect.assertions(2);
        expect(message.valid).toEqual(true);
        expect(message.user).toEqual('user1');
    });

    test('should reject if concurrently rejected', async () => {
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
        );

        const message = await handlerFactory(deps)(requestMessage);
        
        expect.assertions(2);
        expect(message.valid).toEqual(true);
        expect(message.user).toEqual('user1');
    });
});
