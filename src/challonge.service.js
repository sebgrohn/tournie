const R = require('ramda');
const axios = require('axios');

function challongeServiceFactory({ organization, apiKey }) {
    const challongeApi = axios.create({
        baseURL: 'https://api.challonge.com/v1/',
        params: {
            api_key: apiKey,
        },
    });

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

    return {
        fetchOpenTournaments,
    };
}

module.exports = challongeServiceFactory;
