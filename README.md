# aorta

Automated Order Router for Tests of Accessibility (Aorta).

## Introduction

This application receives orders for digital accessibility tests, routes the orders to testers, obtains the results from the testers, and delivers the results to the ordering customers. It asks you for the pages you want to test and the tests you want to perform.

## Architecture

Aorta is a server application with user and application interfaces. Human users can use it with a web browser. Client applications can use it by sending it HTTP POST requests.

The [Testilo](https://github.com/jrpool/testilo) client application is designed to run on Macintosh and Windows computers and act as a tester for Aorta. Testilo uses [Testaro](https://www.npmjs.com/package/testaro) to perform testing.

Aorta recognizes the following entity types:
- user: a human or programmatic agent making requests to Aorta
- tester: a user that has `test` permission
- script: a file containing testing instructions
- batch: a file containing data about URLs to be tested with scripts
- order: a request by a user to have a script, with or without a batch, performed
- job: an order that has been assigned to a tester
- report: a JSON file containing the results of a job
- digest: an HTML file containing a human-readable explanation of a report

An order comes into existence when a user creates it, by specifying script and, optionally, a batch. If a batch is specified, the script will be performed once for each URL in the batch.

A job comes into existence when a user assigns an order to a tester.

A report comes into existence when a tester performs a job and submits the results to Aorta.

Therefore, before any testing can take place, a script must exist, then an order must be created, then the order must be converted to a job, and then the assigned tester must retrieve the job.

## Configuration

Aorta requires some environment variables. By default, it obtains these from the `.env.js` file. You can modify the values in its `env` object, or empty the object and provide the variables by another method.

The default values define `localhost` as the host for Aorta, 3005 as the port, `http` as the protocol, and placeholders for the private key and certificate file paths. If you change the protocol to `https` or `http2`, replace the key and certificate placeholders with the paths to those files.

**Warning**: The `.env.js` file is not named in `.gitignore`, because it contains no secrets. If you add secrets to it, you must add `.env.js` to `.gitignore` to prevent them from being published in a repository.

## Orders

The application requires that orders for tests be compatible with [Testaro](https://www.npmjs.com/package/testaro). Thus, the script and any batch in an order must comply with Testaro rules for scripts and batches.

The `sampleData` directory contains examples of compliant scripts and a compliant batch. Aorta uses these to prepopulate the text areas of the script- and batch-creation forms, to help you adhere to the required formats.

## Authorization

Aorta users can have 0 or more permissions. Every authenticated user can see scripts, batches, orders, and jobs. A user with the following permissions can also:
- `read`: see reports, see digests, and create digests
- `order`: create scripts, create batches, and create orders
- `assign`: create jobs
- `test`: claim* orders and create reports of jobs assigned to that user
- `manage`: see users, create users, and remove anything

*Claiming an order means assigning the order to oneself, thereby creating a job.

Scripts are visible to all authenticated users because scripts usually contain no secrets. However, a script can contain text to be entered into a form, and that text can contain secrets, such as passwords. To make such a script safe for any user to see, you can use the placeholder feature of the `text` command of Testaro, by substituting a placeholder such as `__PASSWORDX__` for an environment variable `PASSWORDX`.

Alternatively, if you wish to change the privileges of users, you can modify the `roles` constant in the `index.js` file.

## Initialization

When Aorta is first installed, it has no users. Until there are any users, Aorta disregards its authentication form and permits you to do everything. Once a user exists, Aorta enforces the authorization requirements described above.

Therefore, your first action after installing Aorta should be to create a user with `manage` permission. After that, you can authenticate as that user and perform other actions.

The `sampleData` directory contains an example of a user file. Aorta uses this to prepopulate the text area of the user-creation form, to help you define a user in the required format.
