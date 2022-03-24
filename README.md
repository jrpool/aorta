# aorta

Automated Order Router for Tests of Accessibility (Aorta).

## Introduction

This application receives orders for digital accessibility tests, routes the orders to testers, obtains the results from the testers, and delivers the results to the ordering customers. It asks you for the pages you want to test and the tests you want to perform.

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

The `KEY` and `CERT` variables are required only if the value of the `PROTOCOL` variable is `http2` or `https`.

## Testers

The testers can be humans or machines.

## Orders

The application requires that orders for tests be compatible with [Testaro](https://www.npmjs.com/package/testaro). This means that an order specifies a script, and optionally a batch. The script and batch must comply with Testaro rules for scripts and batches.

## Authorization

Aorta users can have 0 or more permissions. Every user can see scripts, batches, orders, and jobs. A user with the following permissions can also:
- `read`: see reports, see digests, and create digests
- `order`: create scripts, create batches, and create orders
- `assign`: create jobs
- `test`: claim orders and create reports of jobs assigned to that user
- `manage`: see users, create users, and remove anything

Claiming an order means assigning the order to oneself, thereby creating a job.
