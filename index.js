/*
  index.js
  Aorta main script.
*/

// ########## IMPORTS

// Modules to access files.
const fs = require('fs').promises;
const {readFileSync} = require('fs');
const nodemailer = require('nodemailer');
// Environment variables
try {
  const {env} = require('./.env');
  Object.keys(env).forEach(key => {
    process.env[key] = env[key];
  });
}
catch(error) {
  console.log('No .env.js to get more environment variables from');
};
// Module to create a web server.
const protocolName = process.env.PROTOCOL || 'http';
const protocolServer = require(protocolName);
// Module to parse request bodies.
const {parse} = require('querystring');

// ########## CONSTANTS

// Permissions to see, create, and remove targets.
const roles = {
  script: ['', 'order', 'manage'],
  batch: ['', 'order', 'manage'],
  order: ['', 'order', 'manage'],
  job: ['', 'assign', 'manage'],
  report: ['read', 'test', 'manage'],
  digest: ['read', 'read', 'manage'],
  user: ['manage', 'manage', 'manage']
};
// Name of the sample script to be used as the initial value of a new script.
const scriptInit = 'asp09';

// ########## FUNCTIONS

// ==== OPERATION UTILITIES ====

// Sends an email message to a user.
const email = async (userName, subject, body) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_SERVER,
    port: process.env.SMTP_PORT,
    secure: false
  });
  const userDataJSON = await fs.readFile(`data/users/${userName}.json`);
  const userData = JSON.parse(userDataJSON);
  const to = userData.email;
  if (transporter.host && transporter.port) {
    await transporter.sendMail({
      from: process.env.MAIL_SENDER,
      replyTo: process.env.REPLY_TO,
      to,
      subject,
      text: body
    });
    console.log(`Email notice of report sent to ${userName}`);
  }
  else {
    console.log('No email notice sent');
  }
};
// Sends stringifiable content as an API response.
const sendAPI = async (content, response) => {
  response.setHeader('Content-Type', 'text/json');
  await response.end(JSON.stringify(content));
};
// Serves HTML content as a response.
const servePage = async (content, location, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.setHeader('Content-Location', location);
  await response.end(content);
};
// Replaces the placeholders in content with eponymous query parameters.
const replaceHolders = (content, query) => content
.replace(/__([a-zA-Z]+)__/g, (ph, qp) => query[qp]);
// Serves a page with placeholders replaced.
const render = async (nameBase, query, response) => {
  if (! response.writableEnded) {
    // Get the page.
    const page = await fs.readFile(`${nameBase}.html`, 'utf8');
    // Replace its placeholders with eponymous query parameters.
    const renderedPage = replaceHolders(page, query);
    // Serve the page.
    await servePage(renderedPage, `/aorta/${nameBase}.html`, response);
  }
};
// Serves a file.
const serveFile = async (fileName, contentType, encoding, response) => {
  const readArgs = [fileName];
  if (encoding) {
    readArgs.push(encoding);
  }
  content = await fs.readFile(...readArgs);
  response.setHeader('Content-Type', contentType);
  response.end(content);
};
// Serves content to be saved to a file.
const serveAttachment = async (content, saveName, contentType, response) => {
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${saveName}"`);
  response.end(content);
};
// Processes a thrown error.
const err = async (error, context, response, isAPI = false) => {
  let problem = error;
  // If the error is system-defined:
  if (typeof error !== 'string') {
    // Reduce it to a string.
    problem = `${error.message}\n${error.stack}`.replace(
      /^.+<title>|^.+<Errors>|<\/title>.+$|<\/Errors>.+$/gs, ''
    );
  }
  // If the request is an API request:
  if (isAPI) {
    // Remove any HTML markup from the error message.
    problem = problem.replace(/<.*?>/g, '');
  }
  // Serve the error message.
  const msg = `Error ${context}: ${problem}`;
  console.log(msg);
  if (isAPI) {
    await sendAPI(msg, response);
  }
  else {
    const query = {
      errorMessage: msg.replace(/\n/g, '<br>')
    };
    await render('error', query, response);
  }
  return '';
};

// ==== REQUEST-PROCESSING UTILITIES ====

// Returns an order description.
const orderSpecs = order => {
  const mainPart = `from <strong>${order.userName}</strong>, script <strong>${order.scriptName}</strong>`;
  const batchPart = order.batchName ? `, batch <strong>${order.batchName}</strong>` : '';
  return `${mainPart}${batchPart}`;
};
const targetStrings = {
  script: ['Scripts', 'scripts'],
  batch: ['Batches', 'batches'],
  order: ['Orders', 'orders'],
  job: ['Jobs', 'jobs'],
  report: ['Reports', 'reports'],
  digest: ['Digests', 'digests'],
  user: ['Users', 'users'],
  tester: ['Testers', 'users']
};
const targetSpecs = {
  script: target => target.what,
  batch: target => target.what,
  order: target => orderSpecs(target),
  job: target => `${orderSpecs(target)}, tester <strong>${target.tester}</strong>`,
  report: target => `${orderSpecs(target)}, tester <strong>${target.tester}</strong>`,
  user: target => target.name,
  tester: target => target.name
};
const htmlErrorMessages = {
  badAuthCode: 'Incorrect username or authorization code.',
  badUserName: 'Incorrect username or authorization code.',
  noAuthCode: 'Authorization code missing.',
  noUserName: 'Username missing.',
  role: 'You do not have <q>__role__</q> permission.'
};
const apiErrorMessages = {
  badAuthCode: 'badCredentials',
  badUserName: 'badCredentials',
  noAuthCode: 'noAuthCode',
  noUserName: 'noUserName',
  role: 'role'
};
// Get an array of the names of the non-README files in a subdirectory of 'data'.
const dataFileNames = async subdir => {
  const allFileNames = await fs.readdir(`data/${subdir}`);
  return allFileNames.filter(fileName => fileName !== 'README.md');
};
// Get an array of ID-equipped scripts, batches, orders, jobs, users, testers, or reports.
const getTargets = async targetType => {
  // For each target:
  const dir = targetStrings[targetType][1];
  const fileNames = await dataFileNames(dir);
  const targets = [];
  for (const fileName of fileNames) {
    // Get it.
    const targetJSON = await fs.readFile(`data/${dir}/${fileName}`);
    const target = JSON.parse(targetJSON);
    // If the target is valid:
    if (targetType !== 'tester' || target.roles.includes('test')) {
      // If the target has no 'id' property (i.e. is a script or batch):
      if (! target.id) {
        // Use its filename base as an 'id' property.
        target.id = fileName.slice(0, -5);
      }
      // Add the target to the array of targets.
      targets.push(target);
    }
  }
  return targets;
};
// Adds the script, batch, order, job, user, tester, or report HTML items to a query.
const addQueryTargets = async (query, targetType, htmlKey, radioName) => {
  const targets = await getTargets(targetType);
  // Add the target items as a parameter to the query.
  query[htmlKey] = targets.map(target => {
    if (radioName) {
      const input = `<input type="radio" name="${radioName}" value="${target.id}" required>`;
      const specs = targetSpecs[targetType](target);
      return `<div><label>${input} <strong>${target.id}</strong>: ${specs}</label></div>`;
    }
    else {
      return `<li><strong>${target.id}</strong>: ${targetSpecs[targetType](target)}</li>`;
    }
  })
  .join('\n');
};
// Adds the digest HTML items to a query.
const addQueryDigests = async query => {
  const digestFileNames = await dataFileNames('digests');
  const digestNames = digestFileNames.map(fileName => fileName.slice(0, -5));
  query.targets = digestNames.map(digestName => {
    const input
      = `<input type="radio" name="targetName" value="${digestName}" required>`;
    return `<div><label>${input} <strong>${digestName}</strong></label></div>`;
  })
  .join('\n');
};
// Adds a credential field set to a query.
const addYou = query => {
  const youLines = [
    '<fieldset>',
    '<legend>',
    'You',
    '</legend>',
    '<div><label>Username <input name="userName" size="10" required></label></div>',
    '<div><label>Authorization code <input type="password" name="authCode" size="10" required></label></div>',
    '</fieldset>'
  ];
  query.you = youLines.join('\n');
};
// Returns whether a user exists and has a role, or why not.
const userOK = async (userName, authCode, role) => {
  const userFileNames = await dataFileNames('users');
  // If any users exist:
  if (userFileNames.length) {
    // If a user name was specified:
    if (userName) {
      // If it is an existing user name:
      const userIndex = userFileNames.findIndex(fileName => fileName === `${userName}.json`);
      if (userIndex > -1) {
        // Get data on the user.
        const userJSON = await fs.readFile(`data/users/${userFileNames[userIndex]}`, 'utf8');
        const user = JSON.parse(userJSON);
        // If an authorization code was specified:
        if (authCode) {
          // If it is correct:
          if (authCode === user.authCode) {
            // If no role is required or the user has the specified role:
            if (! role || user.roles.includes(role)) {
              // Return success.
              return [];
            }
            else {
              return ['role', role];
            }
          }
          else {
            return ['badAuthCode'];
          }
        }
        else{
          return ['noAuthCode'];
        }
      }
      else {
        return ['badUserName'];
      }
    }
    else {
      return ['noUserName'];
    }
  }
  // Otherwise, i.e. if no users exist yet:
  else {
    // Return success.
    return [];
  }
};
// Validates a web user, serves an error page if invalid, and returns the result.
const screenWebUser = async (role, context, response) => {
  const status = await userOK(userName, authCode, role);
  if (status.length) {
    const errorCode = status[0];
    let message = htmlErrorMessages[errorCode];
    if (errorCode === 'role') {
      message = message.replace('__role__', role);
    }
    await err(message, context, response, false);
    return false;
  }
  else {
    return true;
  }
};
// Validates an API user, sends an error response if invalid, and returns the result.
const screenAPIUser = async (what, userName, authCode, response) => {
  let role = '';
  if (what === 'claimOrder') {
    role = 'test';
  }
  else if (what === 'assignOrder') {
    role = 'assign'
  }
  else if (what === 'createReport') {
    role = 'test'
  }
  const status = await userOK(userName, authCode, role);
  if (status.length) {
    const errorCode = status[0];
    let message = apiErrorMessages[errorCode];
    await sendAPI({error: message}, response);
    return false;
  }
  else {
    return true;
  }
};
// Returns a string representing the date and time.
const nowString = () => (new Date()).toISOString().slice(0, 19);
// Writes an order and serves an acknowledgement page.
const writeOrder = async (userName, options, response) => {
  const id = Math.floor((Date.now() - Date.UTC(2022, 1)) / 500).toString(36);
  const {scriptName, batchName, scriptIsValid, batchIsValid, script, batch} = options;
  const data = {
    id,
    userName,
    orderTime: nowString(),
    scriptName,
    batchName: batchName || '',
    scriptIsValid,
    batchIsValid,
    script
  };
  if (batch) {
    data.batch = batch;
  }
  await fs.writeFile(`data/orders/${id}.json`, JSON.stringify(data, null, 2));
  // Serve an acknowledgement page.
  await render(
    'ack', {message: `Successfully created order <strong>${id}</strong>.`}, response
  );
};
// Validates an existing or proposed job and returns success or a reason for failure.
const jobOK = async (fileNameBase, testerName) => {
  const orderFileNames = await dataFileNames('orders');
  const orderExists = orderFileNames.some(fileName => fileName === `${fileNameBase}.json`);
  if (orderExists) {
    const userFileNames = await dataFileNames('users');
    const userExists = userFileNames.some(fileName => fileName === `${testerName}.json`);
    if (userExists) {
      const userJSON = await fs.readFile(`data/users/${testerName}.json`, 'utf8');
      const user = JSON.parse(userJSON);
      return user.roles.includes('test') ? '' : 'nonTester';
    }
    else {
      return 'nonUser';
    }
  }
  else {
    return 'nonOrder';
  }
}
// Validates a report and returns success or a reason for failure.
const reportOK = async (reportJSON, userName) => {
  try {
    const report = JSON.parse(reportJSON);
    const {id, tester} = report;
    if (! tester) {
      return ['error', 'noTester'];
    }
    else if (tester !== userName) {
      return ['error', 'testerNotYou'];
    }
    else if (! id) {
      return ['error', 'noID'];
    }
    else if (! /^[a-z0-9]+$/.test(id)) {
      return ['error', 'invalidID'];
    }
    else {
      return ['id', id];
    }
  }
  catch(error) {
    return ['error', 'badJSON'];
  }
};
// Assigns an order to a tester, creating a job.
const writeJob = async (assignedBy, fileNameBase, testerName) => {
  // Get the order.
  const orderJSON = await fs.readFile(`data/orders/${fileNameBase}.json`, 'utf8');
  const order = JSON.parse(orderJSON);
  // Add assignment facts to it.
  order.assignedBy = assignedBy;
  order.assignedTime = nowString();
  order.tester = testerName;
  // Add arrays for population by Testaro to it.
  order.log = [];
  order.reports = [];
  // Write it as a job, to be used as a Testaro options object in handleRequest().
  await fs.writeFile(`data/jobs/${fileNameBase}.json`, JSON.stringify(order, null, 2));
  // Delete it as an order.
  await fs.unlink(`data/orders/${fileNameBase}.json`);
};
// Gets the content of a script or batch.
const getOrderPart = async (fileNameBase, partDir) => {
  try {
    const partJSON = await fs.readFile(`data/${partDir}/${fileNameBase}.json`, 'utf8');
    const content = JSON.parse(partJSON);
    return content;
  }
  catch(error) {
    return {error}
  }
};
// Escapes reserved characters for <pre>.
const entify = content => content
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot');
// Handles requests.
const requestHandler = (request, response) => {
  const {method} = request;
  const bodyParts = [];
  request.on('error', err => {
    console.error(err);
  })
  .on('data', chunk => {
    bodyParts.push(chunk);
  })
  .on('end', async () => {
    // Remove any trailing slash from the URL.
    const requestURL = request.url.replace(/\/$/, '');
    // Initialize the query.
    const query = {};
    // METHOD GET: If the request requests a resource:
    if (method === 'GET') {
      // If it is the home page:
      if (requestURL === '/aorta') {
        // Serve it.
        await render('index', {}, response);
      }
      // Otherwise, if it is the actions page:
      else if (requestURL === '/aorta/actions') {
        addYou(query);
        // Serve it.
        await render('actions', query, response);
      }
      // Otherwise, if it is the bulk page:
      else if (requestURL === '/aorta/bulk') {
        addYou(query);
        // Serve it.
        await render('bulk', query, response);
      }
      // Otherwise, if it is the style sheet:
      else if (requestURL === '/aorta/style.css') {
        // Serve it.
        await serveFile('style.css', 'text/css', 'utf8', response);
      }
      // Otherwise, if it is the main script:
      else if (requestURL === '/aorta/script.js') {
        // Serve it.
        await serveFile('script.js', 'text/javascript', 'utf8', response);
      }
      // Otherwise, if it is the bulk-to-Aorta script:
      else if (requestURL === '/aorta/bulkToAorta.js') {
        // Serve it.
        await serveFile('bulkToAorta.js', 'text/javascript', 'utf8', response);
      }
      // Otherwise, if it is the site icon:
      else if (requestURL.startsWith('/aorta/favicon.')) {
        // Serve it.
        await serveFile('favicon.png', 'image/png', '', response);
      }
      // Otherwise, i.e. if the request is invalid:
      else {
        // Serve an error message.
        err(`Invalid request ${requestURL}`, 'processing request', response);
      }
    }
    // METHOD POST: Otherwise, if the request submits a form:
    else if (method === 'POST') {
      // Get the data.
      const body = Buffer.concat(bodyParts).toString();
      const bodyObject = requestURL === '/aorta/api' ? JSON.parse(body) : parse(body);
      // If it is an API request:
      if (requestURL === '/aorta/api') {
        const {what, userName, authCode} = bodyObject;
        // If the user exists and is authorized to make the request:
        if (await screenAPIUser(what, userName, authCode, response)) {
          // If the request is to see the orders:
          if (what === 'seeOrders') {
            // Get them.
            const orders = await getTargets('order');
            // Send them.
            sendAPI(orders, response);
          }
          // Otherwise, if the request is to see the jobs assigned to the requester:
          else if (what === 'seeJobs') {
            // Get them.
            const allJobs = await getTargets('job');
            const ownJobs = allJobs.filter(job => job.tester === userName);
            // Send them.
            sendAPI(ownJobs, response);
          }
          // Otherwise, if the request is to create a job assigned to the requester:
          else if (what === 'claimOrder') {
            // If the request is valid:
            const {orderName} = bodyObject;
            const jobError = await jobOK(orderName, userName);
            if (jobError) {
              await sendAPI({error: jobError}, response);
            }
            else {
              // Create the job.
              await writeJob(userName, orderName, userName);
              // Send an acknowledgement.
              await sendAPI({success: 'orderClaimed'}, response);
            }
          }
          // Otherwise, if the request is to create a job assigned to another tester:
          else if (what === 'assignOrder') {
            // If the request is valid:
            const {orderName, testerName} = bodyObject;
            const jobError = await jobOK(orderName, testerName);
            if (jobError) {
              await sendAPI({error: jobError}, response);
            }
            else {
              // Create the job.
              await writeJob(userName, orderName, userName);
              // Send an acknowledgement.
              await sendAPI({success: 'orderAssigned'}, response);
            }
          }
          // Otherwise, if the request is to create a report:
          else if (what === 'createReport') {
            const {report} = bodyObject;
            // If the report is valid:
            const reportJSON = JSON.stringify(report);
            const reportStatus = await reportOK(reportJSON, userName);
            if (reportStatus[0] === 'error') {
              await sendAPI({error: reportStatus[1]}, response);
            }
            else {
              // Create the report.
              const id = reportStatus[1];
              await fs.writeFile(
                `data/reports/${id}.json`, JSON.stringify(report, null, 2)
              );
              // Delete the job.
              await fs.unlink(`data/jobs/${id}.json`);
              // Send an acknowledgement.
              await sendAPI({success: 'reportCreated'}, response);
              // Notify the order creator by email.
              await email(
                report.userName,
                'Report ready',
                `The Aorta report you ordered (${id}) is ready at ${process.env.EMAIL_LINK}.`
              );
            }
          }
          // Otherwise, if the request is invalid:
          else {
            await sendAPI({error: 'badRequest'});
          }
        }
      }
      // Otherwise, if it is the bulk form:
      else if (requestURL === '/aorta/bulk') {
        const {bulk, userName, authCode} = bodyObject;
        // If the user exists and has permission for the action:
        if (await screenWebUser('manage', 'receiving transfer request', response)) {
          // If the user requested a transfer from Aorta:
          if (bulk === 'fromAorta') {
            // Assemble the data, excluding digests.
            const data = {
              scripts: [],
              batches: [],
              orders: [],
              jobs: [],
              reports: [],
              users: []
            };
            const dataTypes = Object.keys(data);
            for (const dataType of dataTypes) {
              const fileNames = await fs.readdir(`data/${dataType}`);
              const dataFileNames = fileNames.filter(fileName => fileName !== 'README.md');
              for (const fileName of dataFileNames) {
                const fileJSON = await fs.readFile(`data/${dataType}/${fileName}`);
                const obj = JSON.parse(fileJSON);
                const id = fileName.slice(0, -5);
                data[dataType].push({
                  id,
                  obj
                });
              }
            };
            const dataJSON = JSON.stringify(data, null, 2);
            // Serve the data as a file to be saved.
            await serveAttachment(dataJSON, 'aortaData.json', 'application/json', response);
          }
          // Otherwise, i.e. if an upload was requested:
          else {
            // Serve the upload page.
            const query = {};
            addYou(query);
            await render('bulkToAorta', query, response);
          }
        }
      }
      // Otherwise, if it is the upload form:
      else if (requestURL === '/aorta/bulkToAorta') {
        const {dataJSON, userName, authCode} = bodyObject;
        // If the user exists and has permission for the action:
        if (await screenWebUser(userName, authCode, 'manage', 'receiving data', response)) {
          // Add the uploaded data to the Aorta data, replacing any items with identical names.
          try {
            const data = JSON.parse(dataJSON);
            const dataTypes = Object.keys(data);
            for (const dataType of dataTypes) {
              const typeData = data[dataType];
              for (const item of typeData) {
                const itemDataJSON = JSON.stringify(item.obj, null, 2);
                await fs.writeFile(`data/${dataType}/${item.id}.json`, itemDataJSON);
              }
            };
            // Serve an acknowledgement page.
            await render(
              'ack',
              {message: `Successfully transfered bulk data to Aorta.`},
              response
            );
          }
          catch(error) {
            err(error.message, 'transfering data to Aorta', response);
          }
        }
      }
      // Otherwise, if it is the home-page form:
      else if (requestURL === '/aorta/action') {
        const {action, targetType, userName, authCode} = bodyObject;
        if (action) {
          if (targetType) {
            // If the action is to see:
            if (action === 'see') {
              // If the user exists and has permission for the action:
              if (await screenWebUser(
                userName, authCode, roles[targetType][0], 'identifying action', response
              )) {
                // Create a query.
                query.targetType = targetType;
                // If the target type is digest:
                if (targetType === 'digest') {
                  // Add the digest HTML items to the query.
                  await addQueryDigests(query);
                }
                else {
                  await addQueryTargets(query, targetType, 'targets', 'targetName');
                }
                query.TargetType = `${targetType[0].toUpperCase()}${targetType.slice(1)}`;
                addYou(query);
                // Serve the target-choice page.
                await render('seeTargets', query, response);
              }
            }
            // Otherwise, if the action is to create:
            else if (action === 'create') {
              // If the user exists and has permission for the action:
              if (await screenWebUser(
                userName, authCode, roles[targetType][1], 'identifying action', response
              )) {
                // Create a query.
                query.targetType = targetType;
                addYou(query);
                // Serve the target-creation page.
                let pageName;
                if (targetType === 'order') {
                  pageName = 'createOrders';
                  await addQueryTargets(query, 'script', 'scripts', 'scriptName');
                  await addQueryTargets(query, 'batch', 'batches', 'batchName');
                }
                else if (targetType === 'job') {
                  pageName = 'createJobs';
                  await addQueryTargets(query, 'order', 'orders', 'orderName');
                  await addQueryTargets(query, 'tester', 'testers', 'testerName');
                }
                else if (targetType === 'digest') {
                  pageName = 'createDigests';
                  // Identify the digestable reports and host reports.
                  const digesterFileNames = await fs.readdir('digesters');
                  const digesterNames = digesterFileNames
                  .filter(fileName => fileName.endsWith('.js'))
                  .map(fileName => fileName.slice(0, -3));
                  const reports = await getTargets('report');
                  const noBatchReports = reports
                  .filter(report => ! report.batchName && digesterNames.includes(report.scriptName));
                  const batchReports = reports
                  .filter(report => report.batchName && digesterNames.includes(report.scriptName));
                  // Add the no-batch reports as a parameter to the query.
                  noBatchHTML = noBatchReports.map(report => {
                    const input = `<input type="radio" name="reportName" value="${report.id}" required>`;
                    const specs = targetSpecs.report(report);
                    return `<div><label>${input} <strong>${report.id}</strong>: ${specs}</label></div>`;
                  })
                  .join('\n');
                  batchHTML = batchReports.map(report => {
                    const {reports} = report;
                    return reports.map(hostReport => {
                      const input = `<input type="radio" name="reportName" value="${hostReport.id}" required>`;
                      const specs = targetSpecs.report(report);
                      return `<div><label>${input} <strong>${hostReport.id}</strong>: ${specs}</label></div>`;
                    })
                    .join('\n');
                  })
                  .join('\n');
                  query.reports = [noBatchHTML, batchHTML].join('\n');
                }
                else if (['report', 'user'].includes(targetType)) {
                  pageName = 'createNamed';
                  // If a user is to be created:
                  if (targetType === 'user') {
                    // Add an initial value to the query.
                    query.initValue = await fs.readFile(
                      `sampleData/users/userx.json`, 'utf8'
                    );
                  }
                  else {
                    query.initValue = '';
                  }
                }
                else if (['script', 'batch'].includes(targetType)) {
                  pageName = 'createUnnamed';
                  if (targetType === 'script') {
                    query.initValue = await fs.readFile(
                      `sampleData/scripts/${scriptInit}.json`, 'utf8'
                    );
                  }
                  else if (targetType === 'batch') {
                    query.initValue = await fs.readFile(`sampleData/batches/weborgs.json`);
                  }
                }
                await render(pageName, query, response);
              }
            }
            // Otherwise, if the action is to remove:
            else if (action === 'remove') {
              // If the user exists and has permission for the action:
              if (await screenWebUser(
                userName, authCode, roles[targetType][2], 'identifying action', response
              )) {
                // Create a query.
                query.targetType = targetType;
                if (targetType === 'digest') {
                  await addQueryDigests(query);
                }
                else {
                  await addQueryTargets(query, targetType, 'targets', 'targetName');
                }
                addYou(query);
                // Serve the target-choice page.
                await render('removeTargets', query, response);
              }
            }
          }
          else {
            err('Target type missing', 'identifying action', response);
          }
        }
        else {
          err('Action missing', 'identifying action', response);
        }
      }
      // Otherwise, if the form specifies a target to see:
      else if (requestURL === '/aorta/seeTarget') {
        // If the user exists and has permission to see the target:
        const {userName, authCode, targetType, targetName} = bodyObject;
        if (await screenWebUser(
          userName, authCode, roles[targetType][0], `retrieving ${targetType}`, response
        )) {
          // If the target was specified:
          if (targetName) {
            // Get it and add the page parameters to the query.
            const dir = targetStrings[targetType][1];
            const extension = targetType === 'digest' ? 'html' : 'json';
            if (targetType === 'digest') {
              await render(`data/digests/${targetName}`, {}, response);
            }
            else {
              const targetText = await fs.readFile(
                `data/${dir}/${targetName}.${extension}`, 'utf8'
              );
              query.target = extension === 'html' ? targetText : entify(targetText);
              query.targetName = targetName;
              query.targetType = targetType;
              query.TargetType = `${targetType[0].toUpperCase()}${targetType.slice(1)}`;
              // Serve the response page.
              await render('seeTarget', query, response);
            }
          }
          else {
            err(`No ${targetType} selected`, `retrieving ${targetType}`, response);
          }
        }
      }
      // Otherwise, if the form creates an order:
      else if (requestURL === '/aorta/createOrder') {
        // If the user exists and is authorized to create orders:
        const {userName, authCode, scriptName, batchName} = bodyObject;
        if (await screenWebUser(userName, authCode, 'order', 'creating order', response)) {
          // If a script was specified:
          if (scriptName) {
            // Get it and initialize the order options.
            const options = {
              scriptName,
              script: await getOrderPart(scriptName, 'scripts')
            };
            options.scriptIsValid = options.script.hasOwnProperty('what');
            // If a batch was specified or waived:
            if (batchName) {
              // If it was not waived:
              if (batchName !== 'none') {
                // Get the batch and add it to the order options.
                options.batchName = batchName;
                options.batch = await getOrderPart(batchName, 'batches');
                options.batchIsValid = options.batch.hasOwnProperty('what');
              }
              // Write the order and serve an acknowledgement page.
              await writeOrder(userName, options, response);
            }
            else {
              err('No batch option selected', 'creating order', response);
            }
          }
          else {
            err('No script selected', 'creating order', response);
          }
        }
      }
      // Otherwise, if the form creates a job:
      else if (requestURL === '/aorta/createJob') {
        // If the user exists and is authorized to create jobs:
        const {userName, authCode, orderName, testerName} = bodyObject;
        if (await screenWebUser(userName, authCode, 'assign', 'creating job', response)) {
          // If an order was specified:
          if (orderName) {
            // If a tester was specified:
            if (testerName) {
              // Create the job.
              await writeJob(userName, orderName, testerName);
              // Serve an acknowledgement page.
              await render(
                'ack',
                {message: `Successfully created job <strong>${orderName}</strong>.`},
                response
              );
            }
            else {
              err('No tester selected', 'creating job', response);
            }
          }
          else {
            err('No order selected', 'creating job', response);
          }
        }
      }
      // Otherwise, if the form creates a digest:
      else if (requestURL === '/aorta/createDigest') {
        // If the user exists and is authorized to create digests:
        const {userName, authCode, reportName} = bodyObject;
        if (await screenWebUser(userName, authCode, 'read', 'creating digest', response)) {
          // If a report was specified:
          if (reportName) {
            // Create the digest.
            const hasBatch = reportName.includes('-');
            const fileNameBase = hasBatch ? reportName.replace(/-.+$/, '') : reportName;
            const fileJSON = await fs.readFile(
              `data/reports/${fileNameBase}.json`, 'utf8'
            );
            const fileObj = JSON.parse(fileJSON);
            const report = hasBatch
            ? fileObj.reports.filter(hostReport => reportName.endsWith(hostReport.id))[0]
            : fileObj;
            const query = {};
            const {scriptName} = report;
            const {parameters} = require(`${__dirname}/digesters/${scriptName}`);
            parameters(report, query);
            const template = await fs.readFile(`digesters/${scriptName}.html`, 'utf8');
            const digest = replaceHolders(template, query);
            await fs.writeFile(`${__dirname}/data/digests/${reportName}.html`, digest);
            // Serve an acknowledgement page.
            await render(
              'ack',
              {message: `Successfully created digest <strong>${reportName}</strong>.`},
              response
            );
          }
          else {
            err('No report selected', 'creating digest', response);
          }
        }
      }
      // Otherwise, if the form creates a script, batch, report, or user:
      else if (requestURL === '/aorta/createTarget') {
        // If the user exists and is authorized to create targets of the specified type:
        const {userName, authCode, targetType, target} = bodyObject;
        let {targetName} = bodyObject;
        if (await screenWebUser(
          userName, authCode, roles[targetType][1], `creating ${targetType}`, response
        )) {
          // If a target was specified:
          if (target) {
            try {
              // Parse it as JSON.
              const targetObj = JSON.parse(target);
              // If it has a content-derived name:
              if (['report', 'user'].includes(targetType)) {
                // Derive the name.
                targetName = targetObj.id;
              }
              // If the name has a valid format:
              if (/^[a-z0-9]+$/.test(targetName)) {
                // If the name is not already used:
                const dir = targetStrings[targetType][1];
                const fileNames = await dataFileNames(dir);
                if (fileNames.map(fileName => fileName.slice(0, -5)).includes(targetName)) {
                  err('ID already exists', `creating ${targetType}`, response);
                }
                else {
                  // Create the target.
                  await fs.writeFile(`data/${dir}/${targetName}.json`, target);
                  // If the target is a report:
                  if (targetType === 'report') {
                    // Delete any existing digest of a prior version of the same report.
                    await fs.unlink(`data/digests/${targetName}.html`, {force: true});
                  }
                  // Serve an acknowledgement page.
                  query.message = `Successfully created ${targetType} <strong>${targetName}</strong>.`;
                  await render('ack', query, response);
                }
              }
              else {
                err('ID invalid', `creating ${targetType}`, response);
              }
            }
            catch(error) {
              err(error.message, `creating ${targetType}`, response);
            }
          }
          else {
            err(`No content entered`, `creating ${targetType}`, response);
          }
        }
      }
      // Otherwise, if the action is to remove a target:
      else if (requestURL === '/aorta/removeTarget') {
        // If the user exists and has permission for the action:
        const {userName, authCode, targetType, targetName} = bodyObject;
        if (await screenWebUser(
          userName, authCode, roles[targetType][2], `removing ${targetType}`, response
        )) {
          // If the target was specified:
          if (targetName) {
            // Delete it.
            const extension = targetType === 'digest' ? 'html' : 'json';
            await fs.unlink(`data/${targetStrings[targetType][1]}/${targetName}.${extension}`);
            // Add the page parameters to the query.
            query.message = `You have successfully removed ${targetType} <strong>${targetName}</strong>.`;
            // Serve the response page.
            await render('ack', query, response);
          }
          else {
            err(`No ${targetType} selected', 'removing ${targetType}`, response);
          }
        }
      }
      // Otherwise, i.e. if the form is unknown:
      else {
        err('Invalid request submitted', 'in Aorta', response);
      }
    }
    // Otherwise, i.e. if the method is invalid:
    else {
      // Serve an error page.
      err('Unanticipated request method', 'in Aorta', response);
    }
  });
};

// ########## SERVER

  // Environment variables are defined in Dockerfile or .env.js.
  const serverOptions = {};
if (['http2', 'https'].includes(protocolName)) {
  serverOptions.key = readFileSync(process.env.KEY, 'utf8');
  serverOptions.cert = readFileSync(process.env.CERT, 'utf8');
  serverOptions.allowHTTP1 = true;
}
const creator = protocolName === 'http2' ? 'createSecureServer' : 'createServer';
const server = protocolServer[creator](serverOptions, requestHandler);
// Listens for requests.
const serve = async () => {
  /*
  // Delete the README.md files of the data subdirectories. They exist to force directory tracking.
  for (const subdir of ['batches', 'digests', 'jobs', 'orders', 'reports', 'scripts', 'users']) {
    await fs.unlink(`data/${subdir}/README.md`, {force: true});
  };
  */
    /*
  // Create the data directory and its subdirectories, insofar as they are missing.
  for (const subdir of ['batches', 'digests', 'jobs', 'orders', 'reports', 'scripts', 'users']) {
    try {
      await fs.mkdir(`data/${subdir}`);
    }
    catch(error) {
      console.log(`Did not create data/${subdir}: ${error.message}`);
    }
  }
  */
  const port = process.env.HOSTPORT || '3005';
  server.listen(port, () => {
    console.log(
      `Server listening at ${protocolName}://${process.env.HOST || 'localhost'}:${port}/aorta.`
    );
  });
};
// Start the server.
serve();

// ########## PLATFORM

/**
 * @description Gracefully shut down Node and clean up.
 *
 */
 function shutdownNode() {
  console.log('\nShutting down Node.');
  // Perform any cleanup.
  process.exit(0);
}
/**
* @description Handle unhandled exceptions in the code.
* @param err
*/
function handleUncaughtException(err) {

  console.log('Unhandled exception occurred.' , err);
  // Uncomment if DB connection is made
  console.log('Unhandled exception or rejection. Node is shut down.');
  process.exit(1);
}
// Process shutdown and error conditions.
process.on('SIGTERM', shutdownNode);
process.on('SIGINT', shutdownNode);
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUncaughtException);
