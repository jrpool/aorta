# aorta

Automated Order Router for Tests of Accessibility (Aorta).

## Introduction

This application receives orders for digital accessibility tests, routes the orders to testers, obtains the results from the testers, and delivers the results to the ordering customers. It asks you for the pages you want to test and the tests you want to perform.

## Architecture

Aorta is a server application with user and application interfaces. Human users can use it with a web browser. Client applications can use it by sending it HTTP POST requests.

The [Testilo](https://github.com/jrpool/testilo) client application is designed to run on Macintosh and Windows computers and act as a tester for Aorta. Testilo depends on [Testaro](https://www.npmjs.com/package/testaro) to perform testing. Therefore, to make use of Aorta you should install Testilo on at least one computer and configure its `.env` file so it knows where your installation of Aorta can be found.

Aorta recognizes the following entity types:
- user: a human or programmatic agent making requests to Aorta
- tester: a user that has `test` permission
- script: a file containing testing instructions
- batch: a file containing data about URLs to be tested with scripts
- order: a request by a user to have a script, with or without a batch, performed
- job: an order that has been assigned to a tester
- report: a JSON file containing the results of a job
- digest: an HTML file containing a human-readable explanation of a report

An order comes into existence when a user creates it, by specifying a script and, optionally, a batch. If a batch is specified, the script will be performed once for each _host_ (a URL with a name) in the batch. If no batch is specified, the script will be performed with whatever hosts are in the script.

A job comes into existence when a user assigns an order to a tester. A tester can assign an order to itself, which is called _claiming_ an order.

A report comes into existence when a tester performs a job and submits the results to Aorta. If the job involves a batch, then the report includes an array of _host reports_, one per host. Otherwise that array contains only the report.

Before any testing can take place, a script must exist, then an order must be created, then the order must be converted to a job, and then the assigned tester must retrieve the job.

## Configuration

Aorta requires some environment variables. By default, it obtains these from an `.env.js` file.

Here is a sample of an `.env.js` file:

```javascript
exports.env = {
  HOST: 'localhost',
  HOSTPORT: 3005,
  PROTOCOL: 'http',
  KEY: 'path-to-your-pem-private-key-file',
  CERT: 'path-to-your-pem-certificate-file',
  SMTP_SERVER: 'smtp.server.net',
  SMTP_PORT: 25,
  MAIL_SENDER: 'no-reply@aortaservice.com',
  REPLY_TO: 'jane.doe@organization.com',
  EMAIL_LINK: 'https://apps.organization.com/aorta/actions'
}
```

The last 5 properties in the sample are parameters for the email notices that Aorta sends to users when reports of jobs that they ordered have been completed and deposited with Aorta.

If you change the protocol to `https` or `http2`, replace the key and certificate placeholders with the paths to those files.

## Orders

The application requires that orders for tests be compatible with [Testaro](https://www.npmjs.com/package/testaro). Thus, the script and any batch in an order must comply with Testaro rules for scripts and batches.

The `sampleData` directory contains examples of compliant scripts and a compliant batch. Aorta uses these to prepopulate the text areas of the script- and batch-creation forms, to help you adhere to the required formats.

## Authorization

Aorta users can have 0 or more _permissions_. Every authenticated user can see scripts, batches, orders, and jobs. A user with the following permissions can also:
- `read`: see reports, see digests, and create digests
- `order`: create scripts, create batches, and create orders
- `assign`: create jobs
- `test`: claim orders and create reports of jobs assigned to that user
- `manage`: see users, create users, and remove anything

Scripts are visible to all authenticated users because scripts usually contain no secrets. However, a script can contain text to be entered into a form, and that text can contain secrets, such as passwords. To make such a script safe for any user to see, you can use the placeholder feature of the `text` command of Testaro, by substituting a placeholder such as `__PASSWORDX__` for an environment variable `PASSWORDX`.

If you wish to change the rules that determine which permissions entitle users to do what, you can modify the `roles` constant in the `index.js` file.

## Initialization

When Aorta is first installed, it has no scripts, batches, orders, jobs, reports, digests, or users. Until there are any users, Aorta disregards its authentication form and permits anybody to do anything. Once a user exists, Aorta enforces the authorization requirements described above.

Therefore, your first action after installing Aorta should be to create a user (perhaps yourself) with `manage` permission. After that, you can authenticate as that user and perform other actions.

One of your next actions should be to create at least one user with `test` and `assign` permissions. Then you can install Testilo on one or more computers and configure each instance to interact with your server instance of Aorta.

## Launch

To start Aorta working, navigate to its root directory and enter `node index`. Then do the same in the root directory of Testilo on each computer where you have installed it.

This will make your testers check Aorta periodically for jobs they can run and orders they can claim. Meanwhile, your human users can create orders for testers to claim and perform.

When a tester performs a job and submits its report to Aorta, Aorta will send an email message to the user who created the order, letting the user know the report is ready to see. If the report is of a type that has a digester, any user with `read` permission can create a digest from it and see the digest.
