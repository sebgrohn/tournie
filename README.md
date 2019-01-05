# Tournie Challonge bot [![Build Status](https://travis-ci.com/sebgrohn/tournie.svg?branch=master)](https://travis-ci.com/sebgrohn/tournie)

**Tournie,** the Challonge bot for Slack. Hosted as an AWS Lambda.


# Features

* Listing open tournaments for configured Challonge organization.
* Connecting Slack user with Challonge member by "logging in". Suggestions from
  previous tournaments by configured Challonge organization.
* Listing next matches for user, for tournaments s/he is part of.

See the [Primer wiki page](/sebgrohn/tournie/wiki/Primer-on-Tournie-Challonge-bot)
regarding future development.


# Installation

1. Set up AWS credentials, with a profile called "claudia". (You can use `aws-credentials.example`
   as a template by copying it to `~/.aws/credentials` and filling in your accesss id and key.)
   See [Claudia set-up instructions](https://claudiajs.com/tutorials/installing.html) regarding
   what policies the user needs to have.

2. Copy `challonge.json.example` to `challonge.json` and enter Challonge organization sub-domain
   and Challonge user API key.

3. Create Slack app.

4. Follow [Claudia set-up instructions](https://claudiajs.com/tutorials/installing.html) and deploy to AWS:
   ```
   npx claudia create --region eu-west-1 --api-module index --configure-slack-slash-app --profile claudia
   ```

5. Add read / write policy for SimpleDB for the AWS IAM role (probably "tournie-executor").

# Re-deploy / update

```
npx claudia update --cache-api-config --profile claudia
```


# License

Licenced under the [MIT License](LICENSE).
