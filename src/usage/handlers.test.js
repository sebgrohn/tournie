const handlers = require('./handlers');

test('showUsage', () => {
    const req = {
        originalRequest: {
            command: 'next',
        },
    };
    const usage = handlers.showUsage()(req);
    expect(usage).toHaveProperty('attachments');
    const { attachments } = usage;
    const [attachment] = attachments;
    expect(attachment).toHaveProperty('text');
});
