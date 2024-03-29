# feathers-saml

[![Latest Stable Version](https://img.shields.io/npm/v/feathers-saml.svg)](https://www.npmjs.com/package/feathers-saml) [![Dependency Status](https://img.shields.io/david/winteragency/feathers-saml.svg?style=flat-square)](https://david-dm.org/winteragency/feathers-saml) [![Download Status](https://img.shields.io/npm/dm/feathers-saml.svg?style=flat-square)](https://www.npmjs.com/package/feathers-saml) [![License](https://img.shields.io/github/license/winteragency/feathers-saml.svg)](https://github.com/winteragency/feathers-saml) [![Made by Winter](https://img.shields.io/badge/made%20by-%E2%9D%84%20Winter-blue.svg)](https://winteragency.se)

> SAML2 authentication for Feathers using SAML2-js. Makes Feathers act as a Service Provider.

## Introduction

This is an authentication strategy for Feathers v4+. It's based very heavily on [@feathersjs/authentication-oauth](https://github.com/feathersjs/feathers/tree/master/packages/authentication-oauth) and uses [SAML2-js](https://www.npmjs.com/package/saml2-js).

## Installation

```
npm install feathers-saml --save
```

## Get Started

1. [Configure your SP and Idp](#configuration)
2. [Extend SamlStrategy to handle your user data](#samlstrategy)
3. [Implement Express middleware to handle SAML URLs](#express)

Finally, implement the strategy in your `authentication.js` file:

```js
authentication.register('saml', new MySamlStrategy());
```

## Configuration

Configuration and usage will depend on your IdP. To get started, configure your SP and IdP by adding a new block to the `authentication` object in your `config/default.json`:

```json
{
  "authentication": {
    "saml": {
      "sp": {
          "entity_id": "https://app.example.com",
          "private_key": "sp-key.pem",
          "certificate": "sp-cert.crt",
          "assert_endpoint": "https://sp.example.com/assert"
      },
      "idp": {
          "sso_login_url": "https://some-idp.org/saml/SSO",
          "sso_logout_url": "https://some-idp.org/saml/SLO",
          "certificates": ["idp-cert.crt"]
      },
      "loginRequestOptions": {
        // Optional additional options for the login request, such as "relay_state", see https://www.npmjs.com/package/saml2-js#create_login_request_url
      },
      "loginResponseOptions": {
        // Optional additional options for the login response, such as "relay_state", see https://www.npmjs.com/package/saml2-js#post_assert
      },
      "logoutRequestOptions": {
        // Optional additional options for the logout request, such as "relay_state", see https://www.npmjs.com/package/saml2-js#create_logout_response_url
      },
      "logoutResponseOptions": {
        // Optional additional options for the logout response, such as "relay_state", see https://www.npmjs.com/package/saml2-js#create_logout_request_url
      },
      "samlTokenExpiry": "30s" // Optionally use a different JWT expiry time for the token generated during the SAML process
    }
  }
}

```

> __Note:__ If any of `authentication.saml`, `authentication.saml.sp` or  `authentication.saml.idp` are not set in the configuration, SAML authentication will be disabled.

The `sp` and `idp` objects map pretty much directly to [the parameters of saml2-js](https://www.npmjs.com/package/saml2-js#options).
The exception is the `private_key`, `certificate` and `certificates` properties; you should set these to the file paths of your respective certs and keys, and this module will read those files for you. This is to avoid needing to have the certificates as strings in JSON.

In addition to the `saml2-js` options, the following settings are available:

- `redirect`: The URL of the frontend to redirect to with the access token (or error message). The [authentication client](https://docs.feathersjs.com/api/authentication/client.html) handles those redirects automatically. If not set, the authentication result will be sent as JSON instead.
- `path` (default: `'/saml'`) - The SAML base path

## Usage

### Flow

- User clicks on link to SAML URL (`/saml`)
- Gets redirected to Identity Provider and authorizes the application
- IdP redirects back to the ACS url (`/saml/assert`). SAML assertion is validated.
- The [SamlStrategy](#samlstrategy) is invoked, which
    - Gets the users profile
    - Finds or creates the user (entity) for that profile
- The [AuthenticationService](https://docs.feathersjs.com/api/authentication/service.html) creates an access token for that entity. The token payload will additionally include `nameId` and `sessionIndex` which are required later for logout.
- Redirect to the `redirect` URL including the generated access token
- The frontend (e.g. [authentication client](https://docs.feathersjs.com/api/authentication/client.html)) uses the returned access token to authenticate
- The frontend can redirect the user to `/saml/logout?nameId=xxx&sessionIndex=xxx` to trigger the SAML logout flow, providing the `nameId` and `sessionIndex` from the access token payload

### SAML URLs

There are several URLs and redirects that are important for SAML authentication:

- `http(s)://<host>/saml`: The main URL to initiate the SAML flow. Link to this from the browser.
- `http(s)://<host>/saml/metadata.xml`: The URL to the generated SP metadata file, to be provided to the IdP.
- `http(s)://<host>/saml/assert`: The ACS that the IdP will redirect back to for validation.
- `http(s)://<host>/saml/logout`: The URL to trigger the SAML logout flow
- `http(s)://<host>/saml/sso`: The SLO endpoint the IdP should redirect to after a successful logout

In the browser a SAML flow can be initiated with a link like:

```html
<a href="/saml">Login with IdentityProvider</a>
```

or

```html
<a href="/saml/logout?nameId={{ nameIdFromJWTPayload }}&sessionIndex={{ sessionIndexFromJWTPayload }}">Logout</a>
```

### Redirects

> __Note:__ This functionality is stolen directly from [@feathersjs/authentication-oauth](https://github.com/feathersjs/feathers/tree/master/packages/authentication-oauth) with the exception of the custom JWT lifetime option.

The `redirect` configuration option is used to redirect back to the frontend application after SAML authentication was successful and an access token for the user has been created by the [authentication service](https://docs.feathersjs.com/api/authentication/service.html) or if authentication failed. It works cross domain and by default includes the access token or error message in the window location hash. The following configuration

```js
{
  "authentication": {
    "saml": {
      "redirect": "https://app.mydomain.com/"
    }
  }
}
```

Will redirect to `https://app.mydomain.com/#access_token=<user jwt>` or `https://app.mydomain.com/#error=<some error message>`. Redirects can be customized with the [getRedirect()](#getredirect-data) method of the SAML strategy. The [authentication client](https://docs.feathersjs.com/api/authentication/client.html) handles the default redirects automatically already.

> __Note:__ The redirect is using a hash instead of a query string by default because it is not logged server side and can be easily read on the client. You can force query based redirect by adding a `?` to the end of the `redirect` option.

If the `redirect` option is not set, the authentication result data will be sent as JSON instead.

#### Important: Location hash security

Passing the JWT as a location hash, while convenient when building for example an SPA, creates a potential attack vector where the browser saves the full URL in its history. This would, on say a shared computer, allow someone to go into the browser history and click on the link and be immediately authenticated, provided the JWT hasn't expired.

This module has a `samlTokenExpiry` option in its configuration which can be set to something very short, such as `30s`. You can then implement a custom JWT strategy that will regenerate a new, long(er)-lived token whenever the short-lived token is used for authentication. This gives an attacker no time to excerise the above attack in practice.

```js
const { JWTStrategy } = require('@feathersjs/authentication')


module.exports = class SamlJWTStrategy extends JWTStrategy {
  async authenticate(authentication, params) {
    const res = await super.authenticate(authentication, params)

    // If the token was generated using the SAML strategy, drop it from
    // the response, causing Feathers to generate a new one automatically.
    // The Feathers Client library will pick up this new token on its own
    // and use it for future requests.
    if (res.authentication.payload.samlToken === true) {
      delete res.accessToken;
    }

    return res;
  }
}

```

## Express

`expressSaml` (for setup see the [AuthenticationService](https://docs.feathersjs.com/api/authentication/service.html)) sets up SAML authentication on a [Feathers Express](https://docs.feathersjs.com/api/express.html) application and can take the following options:

- `authService`: The name of the authentication service

```js
const { expressSaml } = require('feathers-saml');

app.configure(expressSaml());
```

## SamlStrategy

The `SamlStrategy` class is the actual Feathers Authentication Strategy. It will take a SAML response from SAML2-js and retreive and update an existing user or create a new user with whatever data is returned by the IdP. Since the returned information will differ depending on your use case and IdP, you will need to extend this class and implement your own `getEntityQuery` and `getEntityData` methods:

## Implementing you own strategy class

Your IdP will likely return a set of user attributes that will differ between providers. Below is an example of how to handle an IdP returning an email address and a full name for all users, which we'll store locally in our app DB.

```js
const { SamlStrategy } = require('feathers-saml');

class MySamlStrategy extends SamlStrategy {
  /**
   * Retreive user based on email returned by IdP
   */
  async getEntityQuery (samlUser, params) {
    return {
      [`email`]: samlUser.attributes.email
    };
  }

  /**
   * Create/update local user and set their email and fullName as returned by the IdP
   */
  async getEntityData (samlUser: SamlUser, _existingEntity: any, params) {
    return {
        [`email`]: samlUser.attributes.email,
        [`fullName`]: samlUser.attributes.fullName
    };
  }
}
```

### Reference

#### entityId

`samlStrategy.entityId -> string` returns the name of the id property of the entity.

#### getEntityQuery(samlUser, params)

`samlStrategy.getEntityQuery(samlUser, params) -> Promise` returns the entity lookup query to find the entity for a SAML user. By default returns

```js
{
  [`email`]: samlUser.attributes.email[0]
}
```

#### getEntityData(samlUser, entity, params)

`samlStrategy.getEntityData(samlUser, existing, params) -> Promise`  returns the data to either create a new or update an existing entity. 

#### getSamlUser(data, params)

`samlStrategy.getSamlUser(data, params) -> Promise` returns the user information that was returned from the IdP. `data` is the SAMLResponse callback information which normally contains the NameId, SessionIndex and user attributes.

#### getRedirect (data)

`samlStrategy.getRedirect(data) -> Promise` returns the URL to redirect to after a successful SAML login and entity lookup or creation. By default it redirects to `authentication.saml.redirect` from the configuration with `#access_token=<access token for entity>` added to the end of the URL. The `access_token` hash is e.g. used by the [authentication client](https://docs.feathersjs.com/api/authentication/client.html) to log the user in after a successful SAML login. The default redirects do work cross domain.

#### getCurrentEntity(params)

`samlStrategy.getCurrentEntity(params) -> Promise` returns the currently linked entity for the given `params`. It will either use the entity authenticated by `params.authentication` or return `null`.

#### findEntity(samlUser, params)

`samlStrategy.findEntity(samlUser, params) -> Promise` finds an entity for a given SAML user.

#### createEntity(samlUser, params)

`samlStrategy.createEntity(samlUser, params) -> Promise` creates a new entity for the given SAML user.

#### updateEntity(entity, samlUser, params)

`samlStrategy.updateEntity(entity, samlUser, params) -> Promise` updates an existing entity with the given SAML user.

#### authenticate(authentication, params)

`samlStrategy.authenticate(authentication, params)` is the main endpoint implemented by any [authentication strategy](https://docs.feathersjs.com/api/authentication/strategy.html). It is usually called for authentication requests for this strategy by the [AuthenticationService](https://docs.feathersjs.com/api/authentication/service.html).

## License

Heavily based on [@feathersjs/authentication-oauth](https://github.com/feathersjs/feathers/tree/master/packages/authentication-oauth). All credit to daffl and the other amazing Feathers contributors for all their hard work. :)

Copyright (c) 2019 [Feathers contributors](https://github.com/feathersjs/client/graphs/contributors)

Licensed under the [MIT license](LICENSE).