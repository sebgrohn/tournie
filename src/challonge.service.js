const R = require('ramda');

const fetchAllTournaments = ({ api, organization }) => async function () {
    const { data } = await api.get('tournaments.json', {
        params: {
            subdomain: organization,
        },
    });
    return R.map(({ tournament }) => tournament)(data);
};

const fetchOpenTournaments = ({ api, organization }) => async function () {
    const { data } = await api.get('tournaments.json', {
        params: {
            subdomain: organization,
            // state: '...', // one of 'all', 'pending', 'in_progress', 'ended'
        },
    });
    return R.pipe(
        R.map(({ tournament }) => tournament),
        R.filter(({ state }) => ['pending', 'underway'].includes(state)),
    )(data);
};

const fetchTournament = ({ api }) => async function (tournamentId) {
    const { data } = await api.get(`tournaments/${tournamentId}.json`, {
        params: {
            include_participants: 1,
            include_matches: 1,
        },
    });
    const { tournament } = data;
    return R.evolve({
        participants: R.map(({ participant }) => participant),
        matches: R.map(({ match }) => match),
    })(tournament);
};

const fetchMembers = ({ api, organization }) => async function () {
    const tournaments = await fetchAllTournaments({ api, organization })();

    const tournamentsDetailsPromises = R.pipe(
        R.take(5),
        R.map(({ id }) => id),
        R.map(fetchTournament({ api })),
    )(tournaments);
    const tournamentsDetails = await Promise.all(tournamentsDetailsPromises);

    return R.pipe(
        R.chain(({ participants }) => participants),
        R.uniqBy(({ email_hash }) => email_hash),
        R.project(['username', 'email_hash', 'challonge_email_address_verified']),
    )(tournamentsDetails);
};

const fetchTournamentsForMember = ({ api, organization }) => async function (memberEmailHash, signedUp) {
    const tournaments = await fetchOpenTournaments({ api, organization })();

    const tournamentsDetailsPromises = R.pipe(
        R.map(({ id }) => id),
        R.map(fetchTournament({ api })),
    )(tournaments);
    const tournamentsDetails = await Promise.all(tournamentsDetailsPromises);

    const filterFunc = signedUp
        ? R.any
        : R.none;

    return R.pipe(
        R.filter(({ state }) => state === 'pending'),
        R.filter(({ participants }) =>
            filterFunc(({ email_hash }) => email_hash === memberEmailHash)(participants),
        ),
    )(tournamentsDetails);
};

const fetchOpenMatchesForMember = ({ api, organization }) => async function (memberEmailHash) {
    const tournaments = await fetchOpenTournaments({ api, organization })();

    const tournamentsDetailsPromises = R.pipe(
        R.map(({ id }) => id),
        R.map(fetchTournament({ api })),
    )(tournaments);
    const tournamentsDetails = await Promise.all(tournamentsDetailsPromises);

    const tournamentsById = R.indexBy(t => t.id)(tournaments);

    const participantsById = R.pipe(
        R.chain(({ participants }) => participants),
        R.indexBy(p => p.id),
    )(tournamentsDetails);

    return R.pipe(
        R.chain(({ matches }) => matches),
        R.filter(({ state }) => ['pending', 'open'].includes(state)),
        R.map(m => ({
            ...m,
            tournament: tournamentsById[m.tournament_id],
            player1: m.player1_id ? participantsById[m.player1_id] : null,
            player2: m.player2_id ? participantsById[m.player2_id] : null,
        })),
        R.filter(({ player1, player2 }) =>
            player1 && player1.email_hash === memberEmailHash
                || player2 && player2.email_hash === memberEmailHash),
    )(tournamentsDetails);
};

const addTournamentParticipant = ({ api }) => async function (tournamentId, memberUsername, participantName = undefined) {
    const { data } = await api.post(`tournaments/${tournamentId}/participants.json`, {
        participant: {
            challonge_username: memberUsername,
            name: participantName,
        },
    });
    return data.participant;
};

const challongeService = {
    fetchAllTournaments,
    fetchOpenTournaments,
    fetchTournament,
    fetchMembers,
    fetchTournamentsForMember,
    fetchOpenMatchesForMember,
    addTournamentParticipant,
};

module.exports = challongeService;
