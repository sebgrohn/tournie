const R = require('ramda');
const challongeService = require('./challonge.service');

const memberView = R.pick(['username', 'email_hash', 'challonge_email_address_verified']);

const organization = 'company'; // use the same org for all tests

const p1 = { id: 'p1', username: 'username1', email_hash: 'email_hash1', challonge_email_address_verified: 'challonge_email_address_verified1' };
const p2 = { id: 'p2', username: 'username2', email_hash: 'email_hash2', challonge_email_address_verified: 'challonge_email_address_verified2' };
const p3 = { id: 'p3', username: 'username3', email_hash: 'email_hash3', challonge_email_address_verified: 'challonge_email_address_verified3' };

const t1 = {
    id: 't1',
    state: 'underway',
    participants: [
        { participant: p1 }, 
        { participant: p2 },
    ],
    matches: [ 
        { match: { state: 'open', player1_id: 'p1', player2_id: 'p2' } },
    ],
};
const t2 = {
    id: 't2',
    state: 'not open',
    participants: [
        { participant: p1 },
        { participant: p3 },
    ],
    matches: [],
};
const t3 = {
    id: 't3',
    state: 'pending',
    participants: [
        { participant: p1 },
        { participant: p2 },
    ],
    matches: [],
};
const t4 = {
    id: 't4',
    state: 'pending',
    participants: [
        { participant: p1 },
        { participant: p3 },
    ],
    matches: [],
};

const mockApi = spyFunc => ({
    get: async (route, query) => {
        spyFunc(route, query);
        switch (route) {
            case 'tournaments.json':
                return {
                    data: [
                        { tournament: t1 },
                        { tournament: t2 },
                        { tournament: t3 },
                        { tournament: t4 },
                    ],
                };
            case 'tournaments/t1.json':
                return {
                    data: { tournament: t1 },
                };
            case 'tournaments/t2.json':
                return {
                    data: { tournament: t2 },
                };
            case 'tournaments/t3.json':
                return {
                    data: { tournament: t3 },
                };
            case 'tournaments/t4.json':
                return {
                    data: { tournament: t4 },
                };
            default:
                return undefined;
        }
    },

    post: async (route, query) => {
        spyFunc(route, query);
        return {
            data: { participant: query },
        };
    },
});

test('fetchAllTournaments', async () => {
    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const tournaments = await challongeService
        .fetchAllTournaments({ api, organization })();

    expect(spyFunc.mock.calls).toHaveLength(1);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments.json', { params: { subdomain: 'company' } }]);
    expect(tournaments).toEqual([t1, t2, t3, t4]);
});

test('fetchOpenTournaments', async () => {
    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const tournaments = await challongeService
        .fetchOpenTournaments({ api, organization })();

    expect(spyFunc.mock.calls).toHaveLength(1);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments.json', { params: { subdomain: 'company' } }]);
    expect(tournaments).toEqual([t1, t3, t4]);
});

test('fetchTournament', async () => {
    const tournamentId = 't2';
    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const tournament = await challongeService
        .fetchTournament({ api, organization })(tournamentId);

    expect(spyFunc.mock.calls).toHaveLength(1);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments/t2.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(tournament).toEqual({
        id: 't2',
        state: 'not open',
        participants: [
            { id: 'p1', username: 'username1', email_hash: 'email_hash1', challonge_email_address_verified: 'challonge_email_address_verified1' },
            { id: 'p3', username: 'username3', email_hash: 'email_hash3', challonge_email_address_verified: 'challonge_email_address_verified3' },
        ],
        matches: [],
    });
});

test('fetchMembers', async () => {
    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const members = await challongeService
        .fetchMembers({ api, organization })();

    expect(spyFunc.mock.calls).toHaveLength(5);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments.json', { params: { subdomain: 'company' } }]);
    expect(spyFunc.mock.calls[1])
        .toEqual(['tournaments/t1.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[2])
        .toEqual(['tournaments/t2.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[3])
        .toEqual(['tournaments/t3.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[4])
        .toEqual(['tournaments/t4.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(members).toEqual([
        memberView(p1),
        memberView(p2),
        memberView(p3),
    ]);
});

test('fetchOpenTournamentsForMember signed up', async () => {
    const memberEmailHash = 'email_hash2';

    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const tournaments = await challongeService
        .fetchOpenTournamentsForMember({ api, organization })(memberEmailHash, { signedUpFilter: true });

    expect(spyFunc.mock.calls).toHaveLength(4);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments.json', { params: { subdomain: 'company' } }]);
    expect(spyFunc.mock.calls[1])
        .toEqual(['tournaments/t1.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[2])
        .toEqual(['tournaments/t3.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[3])
        .toEqual(['tournaments/t4.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(tournaments).toEqual([
        {
            id: 't1',
            state: 'underway',
            participants: [
                { id: 'p1', username: 'username1', email_hash: 'email_hash1', challonge_email_address_verified: 'challonge_email_address_verified1' },
                { id: 'p2', username: 'username2', email_hash: 'email_hash2', challonge_email_address_verified: 'challonge_email_address_verified2' },
            ],
            is_signed_up: true,
            matches: [ 
                { state: 'open', player1_id: 'p1', player2_id: 'p2' },
            ],
        },
        {
            id: 't3',
            state: 'pending',
            participants: [
                { id: 'p1', username: 'username1', email_hash: 'email_hash1', challonge_email_address_verified: 'challonge_email_address_verified1' },
                { id: 'p2', username: 'username2', email_hash: 'email_hash2', challonge_email_address_verified: 'challonge_email_address_verified2' },
            ],
            is_signed_up: true,
            matches: [],
        },
    ]);
});

test('fetchOpenTournamentsForMember NOT signed up', async () => {
    const memberEmailHash = 'email_hash2';

    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const tournaments = await challongeService
        .fetchOpenTournamentsForMember({ api, organization })(memberEmailHash, { signedUpFilter: false });

    expect(spyFunc.mock.calls).toHaveLength(4);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments.json', { params: { subdomain: 'company' } }]);
    expect(spyFunc.mock.calls[1])
        .toEqual(['tournaments/t1.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[2])
        .toEqual(['tournaments/t3.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[3])
        .toEqual(['tournaments/t4.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(tournaments).toEqual([
        {
            id: 't4',
            state: 'pending',
            participants: [
                { id: 'p1', username: 'username1', email_hash: 'email_hash1', challonge_email_address_verified: 'challonge_email_address_verified1' },
                { id: 'p3', username: 'username3', email_hash: 'email_hash3', challonge_email_address_verified: 'challonge_email_address_verified3' },
            ],
            is_signed_up: false,
            matches: [],
        },
    ]);
});

test('fetchOpenMatchesForMember', async () => {
    const memberEmailHash = 'email_hash2';
    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const matches = await challongeService
        .fetchOpenMatchesForMember({ api, organization })(memberEmailHash);

    expect(spyFunc.mock.calls).toHaveLength(4);
    expect(spyFunc.mock.calls[0])
        .toEqual(['tournaments.json', { params: { subdomain: 'company' } }]);
    expect(spyFunc.mock.calls[1])
        .toEqual(['tournaments/t1.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[2])
        .toEqual(['tournaments/t3.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(spyFunc.mock.calls[3])
        .toEqual(['tournaments/t4.json', { params: { include_matches: 1, include_participants: 1 } }]);
    expect(matches).toEqual([
        {
            player1: {
                challonge_email_address_verified: 'challonge_email_address_verified1',
                email_hash: 'email_hash1',
                id: 'p1',
                username: 'username1',
            },
            player1_id: 'p1',
            player2: {
                challonge_email_address_verified: 'challonge_email_address_verified2',
                email_hash: 'email_hash2',
                id: 'p2',
                username: 'username2',
            },
            player2_id: 'p2',
            state: 'open',
            tournament: undefined,
        },
    ]);
});

test('addTournamentParticipant', async () => {
    const spyFunc = jest.fn();
    const api = mockApi(spyFunc);
    const tournaments = await challongeService
        .addTournamentParticipant({ api, organization })(
            'p4',
            'memberUsername',
            'participantName',
        );

    expect(spyFunc.mock.calls).toHaveLength(1);
    expect(spyFunc.mock.calls[0])
        .toEqual([
            'tournaments/p4/participants.json',
            {
                participant: {
                    challonge_username: 'memberUsername',
                    name: 'participantName',
                },
            },
        ]);
    expect(tournaments).toEqual({
        participant: {
            challonge_username: 'memberUsername',
            name: 'participantName',
        },
    });
});
