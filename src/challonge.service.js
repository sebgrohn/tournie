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

    return {
        fetchAllTournaments,
        fetchOpenTournaments,
        fetchTournamentParticipants,
        fetchMembers,
    };
}

module.exports = challongeServiceFactory;
