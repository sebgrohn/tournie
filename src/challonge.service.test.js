const challongeServiceFactory = require('./challonge.service');

test('fetchAllTournaments', async () => {
  const mockFn = jest.fn();
  const api = {
      get: async (route, query) => {
          mockFn(route, query);
          return { data: [{ tournament: '10' }, { tournament: 'a' }] }
      }
  };
  const organization = 'company';
  const tournaments = await challongeServiceFactory({ api, organization })
    .fetchAllTournaments();

  expect(mockFn.mock.calls.length).toBe(1);
  expect(mockFn.mock.calls[0])
    .toEqual(['tournaments.json', {params: {subdomain: 'company'}}]);
  expect(tournaments).toEqual(['10', 'a']);
});
