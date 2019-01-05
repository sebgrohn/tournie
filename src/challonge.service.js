const R = require('ramda');
const axios = require('axios');

function challongeServiceFactory({ organization, apiKey }) {
    const challongeApi = axios.create({
        baseURL: 'https://api.challonge.com/v1/',
        params: {
            api_key: apiKey,
        },
    });

    async function fetchAllTournaments() {
        const { data } = await challongeApi.get('tournaments.json', {
            params: {
                subdomain: organization,
            },
        });
        return R.map(({ tournament }) => tournament)(data);
    }

    async function fetchOpenTournaments() {
        const { data } = await challongeApi.get('tournaments.json', {
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

    async function fetchTournament(tournamentId) {
        const { data } = await challongeApi.get(`tournaments/${tournamentId}.json`, {
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

    async function fetchTournamentParticipants(tournamentId) {
        const { data } = await challongeApi.get(`tournaments/${tournamentId}/participants.json`);
        return R.map(({ participant }) => participant)(data);
    }

    async function fetchMembers() {
        const tournaments = await fetchAllTournaments();

        const participantsPromises = R.pipe(
            R.take(5),
            R.map(({ id }) => id),
            R.map(fetchTournamentParticipants),
        )(tournaments);
        const participants = await Promise.all(participantsPromises);

        return R.pipe(
            R.unnest,
            R.uniqBy(({ email_hash }) => email_hash),
            R.map(R.pick(['username', 'email_hash', 'challonge_email_address_verified'])),
        )(participants);
    }

    async function fetchOpenMatchesForMember(memberEmailHash) {
        const tournaments = await fetchOpenTournaments();

        const tournamentsDetailsPromises = R.pipe(
            R.map(({ id }) => id),
            R.map(fetchTournament),
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

    async function addTournamentParticipant(tournamentId, memberUsername, participantName = undefined) {
        const { data } = await challongeApi.post(`tournaments/${tournamentId}/participants.json`, {
            participant: {
                challonge_username: memberUsername,
                name: participantName,
            },
        });
        return data.participant;
    }

    return {
        fetchAllTournaments,
        fetchOpenTournaments,
        fetchTournament,
        fetchTournamentParticipants,
        fetchMembers,
        fetchOpenMatchesForMember,
        addTournamentParticipant,
    };
}

module.exports = challongeServiceFactory;
