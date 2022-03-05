# aorta

Automated Opensource Routines for Testing Accessibility (AORTA).

## Introduction

This application tests web pages for accessibility. It asks you for the pages you want to test and the tests you want to perform. Then it uses the [Testaro package](https://www.npmjs.com/package/testaro) to perform the tests and make reports of the results available to you.

## Installation

The direct and indirect dependencies include some hosted by `npmjs` and others hosted by Github Packages. So, installing the dependencies (`npm install`) requires you to have personal access tokens from both registries. Put them into an `.npmrc` file, which can be in your home directory. The statements in `.npmrc` have this format:

```bash
//registry.npmjs.org/:_authToken=...
//npm.pkg.github.com/:_authToken=ghp_...
```

AORTA con be configured with some environment variables. If you wish to use them and have no other mechanism for doing so, you can add an `.env.js` file to the project’s root directory with this format:

```javascript
exports.env = {
  'HOST': 'abc',
  'PORT': 3005,
  'PROTOCOL': 'def',
  'KEY': '/ghi.key',
  'CERT': '/jkl.crt'
}
```

In this example, replace:
- `abc` with `localhost` or a server URL
- `def` with `http2`, `https`, or `http`
- `ghi` with the path to a private SSH key file
- `jkl` with the path to an SSH certificate file
