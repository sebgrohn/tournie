
const mockUserRepository = {
    getUser: async () => ({
        challongeEmailHash: 3,
        challongeUsername: 2,
        slackUserId: 1,
    }),
};

module.exports = mockUserRepository;
