
let region;
try {
    const { lambda } = require('./claudia');
    region = lambda.region;
} catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }
    region = 'eu-west-1';
}

module.exports = region;
