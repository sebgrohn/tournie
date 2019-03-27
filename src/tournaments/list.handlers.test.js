const handlers = require('./list.handlers');

test('listOpenTournaments', async () => {
    const challongeService = {
        fetchOpenTournamentsForMember: async () => [
            {
                id: 't1',
                name: 'a',
                full_challonge_url: 'a_full_challonge_url',
                description: 'a_description',
                game_name: 'a_game_name',
                tournament_type: 'a_tournament_type',
                participants_count: 'a_participants_count',
                signup_cap: 'a_signup_cap',
                started_at: 'a_started_at',
                state: 'a_state',
                progress_meter: 'a_progress_meter',
            },
            {
                id: 't2',
                name: 'b',
                full_challonge_url: 'b_full_challonge_url',
                description: 'b_description',
                game_name: 'b_game_name',
                tournament_type: 'b_tournament_type',
                participants_count: 'b_participants_count',
                signup_cap: 'b_signup_cap',
                started_at: 'b_started_at',
                state: 'b_state',
                progress_meter: 'b_progress_meter',
            },
        ],
    };
    const userRepository = {
        getUser: async () => ({
            challongeEmailHash: 3,
            challongeUsername: 2,
            slackUserId: 1,
        }),
    };
    const req = { sender: 'the user id' };
    const tournaments = await handlers
        .listOpenTournaments({ challongeService, userRepository })(req);
    expect(tournaments).toHaveProperty('attachments.length', 2);
});
