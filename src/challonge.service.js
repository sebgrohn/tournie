const R = require('ramda');

const fetchAllTournaments = ({ api, organization }) => async function () {
    const { data } = await api.get('tournaments.json', {
        params: {
            subdomain: organization,
        },
    });
    return R.map(({ tournament }) => tournament)(data);
}

const fetchOpenTournaments = ({ api, organization }) => async function () {
    const { data } = await api.get('tournaments.json', {
        params: {
            subdomain: organization,
            // state: '...', // one of 'all', 'pending', 'in_progress', 'ended'
        },
    });
    return R.pipe(
        R.map(({ tournament }) => tournament),
        R.filter(t => ['pending', 'underway'].includes(t.state)),
    )(data);
}

const fetchTournament = ({ api }) => async function (tournamentId) {
    const { data } = await api.get(`tournaments/${tournamentId}.json`, {
        params: {
            include_participants: 1,
            include_matches: 1,
        }
    });
    const { tournament } = data;
    return {
        ...tournament,
        participants: R.map(({ participant }) => participant)(tournament.participants),
        matches: R.map(({ match }) => match)(tournament.matches),
    };
}

const fetchTournamentParticipants = ({ api }) => async function (tournamentId) {
    const { data } = await api.get(`tournaments/${tournamentId}/participants.json`);
    return R.map(({ participant }) => participant)(data);
}

const fetchMembers = ({ api, organization }) => async function () {
    const tournaments = await fetchAllTournaments({ api, organization })();

    const participantsPromises = R.pipe(
        R.take(5),
        R.map(({ id }) => id),
        R.map(fetchTournamentParticipants({ api })),
    )(tournaments);
    const participants = await Promise.all(participantsPromises);

    return R.pipe(
        R.unnest,
        R.uniqBy(({ email_hash }) => email_hash),
        R.map(R.pick(['username', 'email_hash', 'challonge_email_address_verified'])),
    )(participants);
}

const fetchOpenMatchesForMember = ({ api, organization }) => async function (memberEmailHash) {
    const tournaments = await fetchOpenTournaments({ api, organization })();

    const tournamentsDetailsPromises = R.pipe(
        R.map(({ id }) => id),
        R.map(fetchTournament({ api })),
    )(tournaments);
    const tournamentsDetails = await Promise.all(tournamentsDetailsPromises);

    const tournamentsById = R.pipe(
        R.map(t => [t.id, t]),
        R.fromPairs,
    )(tournaments);

    const participantsById = R.pipe(
        R.map(({ participants }) => participants),
        R.unnest,
        R.map(p => [p.id, p]),
        R.fromPairs,
    )(tournamentsDetails);

    return R.pipe(
        R.map(({ matches }) => matches),
        R.unnest,
        R.filter(m => ['pending', 'open'].includes(m.state)),
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
}

const addTournamentParticipant = ({ api }) => async function (tournamentId, memberUsername, participantName = undefined) {
    const { data } = await api.post(`tournaments/${tournamentId}/participants.json`, {
        participant: {
            challonge_username: memberUsername,
            name: participantName,
        },
    });
    return data.participant;
}

const challongeService = {
    fetchAllTournaments,
    fetchOpenTournaments,
    fetchTournament,
    fetchTournamentParticipants,
    fetchMembers,
    fetchOpenMatchesForMember,
    addTournamentParticipant,
}

module.exports = challongeService;
