const challongeService = require('../challonge.service.mock');
const userRepository = require('../users').mockRepository;
const handlers = require('./list.handlers');

test('listOpenTournaments', async () => {
    const req = { sender: 'the user id' };
    const tournaments = await handlers
        .listOpenTournaments({ challongeService, userRepository })(req);
    expect(tournaments).toHaveProperty('attachments.length', 2);
});
