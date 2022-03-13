/*
  index.js
  Aorta main script.
*/

// ########## IMPORTS

// Modules to access files.
const fs = require('fs/promises');
const {readFileSync} = require('fs');
// Environment variables
try {
  const {env} = require('./.env');
  Object.keys(env).forEach(key => {
    process.env[key] = env[key];
  });
}
catch(error) {};
// Module to create a web server.
const protocolName = process.env.PROTOCOL || 'http2';
const protocolServer = require(protocolName);
// Module to parse request bodies.
const {parse} = require('querystring');

// ########## CONSTANTS

// Permissions to see, create, and remove targets.
const roles = {
  'script': ['', 'order', 'manage'],
  'batch': ['', 'order', 'manage'],
  'order': ['', 'order', 'manage'],
  'job': ['', 'assign', 'manage'],
  'report': ['read', 'test', 'manage'],
  'user': ['manage', 'manage', 'manage']
};

// ########## FUNCTIONS

// ==== OPERATION UTILITIES ====

// Serves content as a page.
const servePage = async (content, location, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.setHeader('Content-Location', location);
  await response.end(content);
};
// Replaces the placeholders in a page and serves the page.
const render = async (nameBase, query, response) => {
  if (! response.writableEnded) {
    // Get the page.
    const page = await fs.readFile(`./${nameBase}.html`, 'utf8');
    // Replace its placeholders with eponymous query parameters.
    const renderedPage = page.replace(/__([a-zA-Z]+)__/g, (ph, qp) => query[qp]);
    // Serve the page.
    await servePage(renderedPage, `/aorta/${nameBase}.html`, response);
  }
};
// Serves a resource.
const serveResource = async (fileName, contentType, encoding, response) => {
  const readArgs = [fileName];
  if (encoding) {
    readArgs.push(encoding);
  }
  const content = await fs.readFile(...readArgs);
  response.setHeader('Content-Type', contentType);
  response.end(content);
};
// Processes a thrown error.
const err = async (error, context, response) => {
  let problem = error;
  // If error is system-defined:
  if (typeof error !== 'string') {
    // Reduce it to a string.
    problem = `${error.message}\n${error.stack}`.replace(
      /^.+<title>|^.+<Errors>|<\/title>.+$|<\/Errors>.+$/gs, ''
    );
  }
  const msg = `Error ${context}: ${problem}`;
  console.log(msg);
  // Serve an error page containing the error message.
  const query = {
    errorMessage: msg.replace(/\n/g, '<br>')
  };
  await render('error', query, response);
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
  user: ['Users', 'users'],
  tester: ['Testers', 'users']
};
const targetSpecs = {
  script: target => target.what,
  batch: target => target.what,
  order: target => orderSpecs(target),
  job: target => `${orderSpecs(target)}, tester <strong>${target.tester}</strong>`,
  report: target => `${target.id}: ${target.userName}`,
  user: target => target.name,
  tester: target => target.name
};
// Adds the scripts, batches, orders, jobs, users, testers, or reports to a query.
const addTargetParams = async (query, htmlKey, isRadio) => {
  const {targetType} = query;
  // Identify the display format and validity criterion of targets of the specified type.
  const isValid = target => targetType === 'tester' ? target.roles.includes('test') : true;
  const dir = targetStrings[targetType][1];
  // For each target:
  const fileNames = await fs.readdir(`.data/${dir}`);
  let targets = [];
  for (const fileName of fileNames) {
    // Get it.
    const targetJSON = await fs.readFile(`.data/${dir}/${fileName}`);
    const target = JSON.parse(targetJSON);
    // If the target has no 'id' property (i.e. is a script or batch):
    if (! target.id) {
      // Use its filename base as the 'id' property.
      target.id = fileName.slice(0, -5);
    }
    // Add the target to the array of targets, if valid.
    if (isValid(target)) {
      targets.push(target);
    }
  }
  // Add the page parameters to the query.
  query.TargetsName = targetStrings[targetType][0];
  query.TargetType = `${targetType[0].toUpperCase()}${targetType.slice(1)}`;
  query[htmlKey] = targets.map(target => {
    if (isRadio) {
      const input = `<input type="radio" name="targetName" value="${target.id}" required>`;
      const specs = targetSpecs[targetType](target);
      return `<div><label>${input} <strong>${target.id}</strong>: ${specs}</label></div>`;
    }
    else {
      return `<li><strong>${target.id}</strong>: ${targetSpecs[targetType](target)}</li>`;
    }
  })
  .join('\n');
};
// Adds credential inputs to a query.
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
// Returns whether a user exists and has a role.
const userOK = async (userName, authCode, role, context, response) => {
  // If a user name was specified:
  if (userName) {
    // If it is an existing user name:
    const userFileNames = await fs.readdir('.data/users');
    const userIndex = userFileNames.findIndex(fileName => fileName.slice(0, -5) === userName);
    if (userIndex > -1) {
      // Get data on the user.
      const userJSON = await fs.readFile(`.data/users/${userFileNames[userIndex]}`, 'utf8');
      const user = JSON.parse(userJSON);
      // If an authorization code was specified:
      if (authCode) {
        // If it is correct:
        if (authCode === user.authCode) {
          // If no role is required or the user has the specified role:
          if (! role || user.roles.includes(role)) {
            return true;
          }
          // Otherwise, i.e. if the user does not have the specified role:
          else {
            err(`You do not have <q>${role}</q> permission`, context, response);
            return false;
          }
        }
        else {
          err('Username or authorization code invalid', context, response);
          return false;
        }
      }
      else{
        err('Authorization code missing', context, response);
        return false;
      }
    }
    else {
      err('Username or authorization code invalid', context, response);
      return false;
    }
  }
  else {
    err('Username missing', context, response);
    return false;
  }
};
// Returns a string representing the date and time.
const nowString = () => (new Date()).toISOString().slice(0, 19);
// Writes an order and serves an acknowledgement page.
const writeOrder = async (userName, options, response) => {
  const id = Math.floor((Date.now() - Date.UTC(2022, 1)) / 100).toString(36);
  const {scriptName, batchName, script, batch} = options;
  const data = {
    id,
    userName,
    orderTime: nowString(),
    scriptName,
    batchName: batchName || '',
    script
  };
  if (batch) {
    data.batch = batch;
  }
  await fs.writeFile(`.data/orders/${id}.json`, JSON.stringify(data, null, 2));
  // Serve an acknowledgement page.
  await render(
    'ack', {message: `Order successfully received. ID: <strong>${id}</strong>`}, response
  );
};
// Assigns an order to a tester and serves an acknowledgement page.
const assignOrder = async (assignedBy, orderNameBase, testerName, response) => {
  // Get the order.
  const orderJSON = await fs.readFile(`.data/orders/${orderNameBase}.json`, 'utf8');
  const order = JSON.parse(orderJSON);
  // Add assignment facts to it.
  order.assignedBy = assignedBy;
  order.assignedTime = nowString();
  order.tester = testerName;
  // Add arrays for population by Testaro to it.
  order.log = [];
  order.reports = [];
  // Write it as a job, to be used as a Testaro options object in handleRequest().
  await fs.writeFile(`.data/jobs/${orderNameBase}.json`, JSON.stringify(order, null, 2));
  // Delete it as an order.
  await fs.rm(`.data/orders/${orderNameBase}.json`);
  // Serve an acknowledgement page.
  await render(
    'ack',
    {message: `Order successfully assigned as a job. ID: <strong>${orderNameBase}</strong>`},
    response
  );
};
// Gets the content of a script or batch.
const getOrderPart = async (fileNameBase, partDir) => {
  try {
    const partJSON = await fs.readFile(`.data/${partDir}/${fileNameBase}.json`, 'utf8');
    const content = JSON.parse(partJSON);
    return {
      isValid: true,
      content
    };
  }
  catch(error) {
    return {
      isValid: false,
      error
    }
  }
};
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
        // Add the page parameters to the query.
        addYou(query);
        // Serve the page.
        await render('index', query, response);
      }
      // Otherwise, if it is the ordering page:
      else if (requestURL === '/aorta/addOrder') {
        // Add the page parameters to the query.
        await addItems(query, 'script', true);
        await addItems(query, 'batch', true);
        addYou(query);
        // Serve the page.
        await render('order', query, response);
      }
      // Otherwise, if it is the assignment page:
      else if (requestURL === '/aorta/addAssignment') {
        // Add the page parameters to the query.
        await addItems(query, 'order', true);
        await addItems(query, 'tester', true);
        addYou(query);
        // Serve the page.
        await render('assign', query, response);
      }
      // Otherwise, if it is the reporting page:
      else if (requestURL === '/aorta/addReport') {
        // Add the page parameters to the query.
        await addItems(query, 'job', false);
        addYou(query);
        // Serve the page.
        await render('report', query, response);
      }
      // Otherwise, if it is the item-addition page:
      else if (requestURL === '/aorta/add') {
        addYou(query);
        // Serve the page.
        await render('add', query, response);
      }
      // Otherwise, if it is the style sheet:
      else if (requestURL === '/aorta/style.css') {
        // Serve it.
        await serveResource('style.css', 'text/css', 'utf8', response);
      }
      // Otherwise, if it is the script:
      else if (requestURL === '/aorta/script.js') {
        // Serve it.
        await serveResource('script.js', 'text/javascript', 'utf8', response);
      }
      // Otherwise, if it is the site icon:
      else if (requestURL.startsWith('/aorta/favicon.')) {
        // Serve it.
        await serveResource('favicon.png', 'image/png', '', response);
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
      const bodyObject = parse(Buffer.concat(bodyParts).toString());
      // If the form identifies an action and a target type:
      if (requestURL === '/aorta/action') {
        const {action, targetType, userName, authCode} = bodyObject;
        if (action) {
          if (targetType) {
            // If the action is to see:
            if (action === 'see') {
              // If the user exists and has permission for the action:
              if (
                await userOK(userName, authCode, roles[targetType][0], 'identifying action', response)
              ) {
                // Create a query.
                query.targetType = targetType;
                await addTargetParams(query, 'targets', true);
                addYou(query);
                // Serve the target-choice page.
                await render('seeTargets', query, response);
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
      // Ottherwise, if the form asks to see a target:
      else if (requestURL === '/aorta/seeTarget') {
        // If the user exists and has permission to see the target:
        const {userName, authCode, targetType, targetName} = bodyObject;
        if (await userOK(
          userName, authCode, roles[targetType][0], `retrieving ${targetType}`, response
        )) {
          // If the target was specified:
          if (targetName) {
            // Get it and add the page parameters to the query.
            const dir = targetStrings[targetType][1];
            query.target = await fs.readFile(`.data/${dir}/${targetName}.json`, 'utf8');
            query.targetName = JSON.parse(target).id;
            query.targetType = targetType;
            query.TargetType = `${targetType[0].toUpperCase()}${targetType.slice(1)}`;
            // Serve the response page.
            await render('seeTarget', query, response);
          }
          else {
            err(`No ${targetType} selected', 'retrieving ${targetType}`, response);
          }
        }
      }
      // Otherwise, if the form submits an order:
      else if (requestURL === '/aorta/order') {
        // If the user exists and is authorized to submit orders:
        if (await userOK(userName, authCode, 'order', 'submitting order', response)) {
          // If a script was specified:
          if (scriptName) {
            // Get it and initialize the order options.
            options = {
              scriptName,
              script: await getOrderPart(scriptName, 'scripts')
            };
            // If a batch was specified or waived:
            if (batchName) {
              // If it was waived:
              if (batchName === 'none') {
                // Write the order.
                await writeOrder(userName, options, response);
              }
              // Otherwise, if it was specified:
              else {
                // Get the batch and add it to the order options.
                options.batchName = batchName;
                options.batch = await getOrderPart(batchName, 'batches');
                // Write the order and serve an acknowledgement page.
                await writeOrder(userName, options, response);
              }
            }
            else {
              err('No batch option selected', 'submitting order', response);
            }
          }
          else {
            err('No script selected', 'submitting order', response);
          }
        }
      }
      // Otherwise, if the form assigns an order:
      else if (requestURL === '/aorta/assign') {
        // If the user exists and is authorized to assign orders:
        if (await userOK(userName, authCode, 'assign', 'assigning order', response)) {
          // If an order was specified:
          if (orderName) {
            // If a tester was specified:
            if (testerName) {
              // Assign the order to the tester and serve an acknowledgement page.
              await assignOrder(userName, orderName, testerName, response);
            }
            else {
              err('No tester selected', 'assigning order', response);
            }
          }
          else {
            err('No order selected', 'assigning order', response);
          }
        }
      }
      // Otherwise, if the form adds an item:
      else if (requestURL === '/aorta/add') {
        // If the user exists and is authorized to add items:
        if (await userOK(userName, authCode, 'manage', 'adding item', response)) {
          // If an item type was specified:
          if (itemType) {
            // If a filename base was specified:
            if (fileNameBase) {
              // If the filename base is valid:
              if (/^[a-z0-9]+$/.test(fileNameBase)) {
                // If it duplicates an existing file name:
                const dirs = {
                  script: 'scripts',
                  batch: 'batches',
                  user: 'users'
                };
                const fileNames = await fs.readdir(`.data/${dirs[itemType]}`)
                const fileNameBases = fileNames.map(fileName => fileName.slice(0, -5));
                if (fileNameBases.includes(fileNameBase)) {
                  err(`An existing ${itemType} has that filename.`, `adding ${itemType}`, response);
                }
                // Otherwise, i.e. if it is new:
                else {
                  // If content was specified:
                  if (item) {
                    // If it is valid JSON:
                    try {
                      JSON.parse(item);
                      // Write the file.
                      await fs.writeFile(`.data/${dirs[itemType]}/${fileNameBase}.json`, item);
                      // Serve an acknowledgement page.
                      await render(
                        'ack',
                        {message: `Success: New ${itemType} <strong>${fileNameBase}</strong> created.`},
                        response
                      );
                    }
                    catch(error) {
                      err(error.message, `adding ${itemType}`, response);
                    }
                  }
                  else {
                    err('File content missing', `adding ${itemType}`, response)
                  }
                }
              }
              else {
                err('File name invalid', `adding ${itemType}`, response);
              }
            }
            else {
              err('File name missing', `adding ${itemType}`, response);
            }
          }
          else {
            err('No item type selected', `adding ${itemType}`, response);
          }
        }
      }
      // Otherwise, if the form submits a job report:
      else if (requestURL === '/aorta/report') {
        // If the user exists and is authorized to perform jobs:
        if (await userOK(userName, authCode, 'test', 'receiving report', response)) {
          // If content was specified:
          if (report) {
            // If it is valid JSON:
            try {
              // Get its name.
              const data = JSON.parse(report);
              const fileNameBase = data.id;
              // Write the file.
              await fs.writeFile(`.data/reports/${fileNameBase}.json`, report);
              // Serve an acknowledgement page.
              await render(
                'ack',
                {message: `Success: New report <strong>${fileNameBase}</strong> received.`},
                response
              );
            }
            catch(error) {
              err(error.message, 'receiving report', response);
            }
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

const serverOptions = {};
let creator = 'createServer';
if (protocolName === 'http2') {
  serverOptions.key = readFileSync(process.env.KEY, 'utf8');
  serverOptions.cert = readFileSync(process.env.CERT,'utf8');
  serverOptions.allowHTTP1 = true;
  creator = 'createSecureServer';
}
const server = protocolServer[creator](serverOptions, requestHandler);
const serve = async () => {
  // Environment variables are defined in Dockerfile.
  const port = process.env.PORT || '3005';
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
