const region = require('./aws-region');
const userRepositoryFactory = R.applySpec(require('./src/user.repository'));

const simpleDb = new SimpleDB({ region });
const userRepository = userRepositoryFactory(simpleDb);

const command = process.argv[2];
switch (command) {
    case 'up':
        userRepository.setUp()
            .then(userDomain => console.log(`SimpleDB user domain set up: ${userDomain}`))
            .catch(error => {
                console.error(`Could not set up SimpleDB user domain: ${error.message || error}`);
                process.exit(1);
            });
        break;

    case 'down':
        userRepository.tearDown()
            .then(userDomain => console.log(`SimpleDB user domain teared down: ${userDomain}`))
            .catch(error => {
                console.error(`Could not tear down SimpleDB user domain: ${error.message || error}`);
                process.exit(1);
            });
        break;

    default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
        break;
}
