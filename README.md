# aorta

Automated Order Router for Tests of Accessibility (Aorta).

## Introduction

This application receives orders for digital accessibility tests, routes the orders to testing agents, obtains the results from the testing agents, and delivers the results to the ordering customers. It asks you for the pages you want to test and the tests you want to perform.

## Configuration

Aorta con be configured with some environment variables. If you wish to use them and have no other mechanism for doing so, you can add an `.env.js` file to the project’s root directory with this format:

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
