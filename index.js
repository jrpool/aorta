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

// ########## FUNCTIONS

// ==== OPERATION UTILITIES ====

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
    servePage(renderedPage, `/aorta/${nameBase}.html`, response);
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

// ==== REQUEST-PROCESSING UTILITIES ====

// Returns an order description.
const orderSpecs = order => {
  const mainPart = `from <strong>${order.userName}</strong>, script <strong>${order.scriptName}</strong>`;
  const batchPart = order.batchName ? `, batch <strong>${order.batchName}</strong>` : '';
  return `${mainPart}${batchPart}`;
};
// Adds metadata on the scripts, batches, orders, jobs, testers, or reports to a query.
const addItems = async (query, itemType, isRadio) => {
  let inputName, key, dir, specs, addNone;
  if (itemType === 'script') {
    inputName = 'scriptName';
    key = 'scripts';
    dir = 'scripts';
    specs = item => item.what;
  }
  else if (itemType === 'batch') {
    inputName = 'batchName';
    key = 'batches';
    dir = 'batches';
    specs = item => item.what;
    addNone = true;
  }
  else if (itemType === 'order') {
    inputName = 'orderName';
    key = 'orders';
    dir = 'orders';
    specs = item => orderSpecs(item);
  }
  else if (itemType === 'job') {
    inputName = 'jobName';
    key = 'jobs';
    dir = 'jobs';
    specs = item => `${orderSpecs(item)}, tester ${item.tester}`;
  }
  else if (itemType === 'tester') {
    inputName = 'testerName';
    key = 'testers';
    dir = 'users';
    specs = item => item.name;
  }
  else if (itemType === 'report') {
    inputName = 'reportName';
    key = 'reports';
    dir = 'reports';
    specs = item => `${item.id}: ${item.userName}`;
  }
  const itemFileNames = await fs.readdir(`.data/${dir}`);
  let items = [];
  for (const fileName of itemFileNames) {
    const itemJSON = await fs.readFile(`.data/${dir}/${fileName}`);
    const item = JSON.parse(itemJSON);
    // If the item has no 'id' property (i.e. is a script or batch):
    if (! item.id) {
      // Use its filename base as the 'id' property.
      item.id = fileName.slice(0, -5);
    }
    // Classify the item as valid unless testers are being added and the item has no test role.
    item.isValid = itemType === 'tester' ? item.roles.includes('test') : true;
    items.push(item);
  }
  // Add an HTML string encoding radio buttons or list items to the query.
  query[key] = items.filter(item => item.isValid).map(item => {
    if (isRadio) {
      const input = `<input type="radio" name="${inputName}" value="${item.id}">`;
      return `<div><label>${input} <strong>${item.id}</strong>: ${specs(item)}</label></div>`;
    }
    else {
      return `<li><strong>${item.id}</strong>: ${specs(item)}</li>`;
    }
  })
  .join('\n');
};
// Adds credentials inputs to a query
const addYou = query => {
  const youLines = [
    '<fieldset>',
    '<legend>',
    'You',
    '</legend>',
    '<div><label>Username <input name="userName" size="10"></label></div>',
    '<div><label>Authorization code <input type="password" name="authCode" size="10"></label></div>',
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
            err('You are not an authorized user', context, response);
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
  // Write it as a job.
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
      // If the requested resource is the home page:
      if (requestURL === '/aorta') {
        // Serve the page.
        await render('index', {}, response);
      }
      // Otherwise, if it is the ordering page:
      else if (requestURL === '/aorta/order') {
        // Add the page parameters to the query.
        await addItems(query, 'script', true);
        await addItems(query, 'batch', true);
        addYou(query);
        // Serve the page.
        await render('order', query, response);
      }
      // Otherwise, if it is the orders and jobs page:
      else if (requestURL === '/aorta/orderjobs') {
        // Add the page parameters to the query.
        await addItems(query, 'order', false);
        await addItems(query, 'job', false);
        // Serve the page.
        await render('orderjobs', query, response);
      }
      // Otherwise, if it is the assignment page:
      else if (requestURL === '/aorta/assign') {
        // Add the page parameters to the query.
        await addItems(query, 'order', true);
        await addItems(query, 'tester', true);
        addYou(query);
        // Serve the page.
        await render('assign', query, response);
      }
      // Otherwise, if it is the reporting page:
      else if (requestURL === '/aorta/report') {
        // Add the page parameters to the query.
        await addItems(query, 'job', false);
        addYou(query);
        // Serve the page.
        await render('report', query, response);
      }
      // Otherwise, if it is the report-retrieval page:
      else if (requestURL === '/aorta/get') {
        // Add the page parameters to the query.
        await addItems(query, 'report', true);
        addYou(query);
        // Serve the page.
        await render('get', query, response);
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
      const {scriptName, batchName, orders, testers, userName, authCode} = bodyObject;
      // If the form submits an order:
      if (requestURL === '/aorta/order') {
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
                // Write the order.
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
          if (orders) {
            // If a tester was specified:
            if (testers) {
              // Assign the order to the tester and serve an acknowledgement page.
              await assignOrder(userName, orders, testers);
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
      else {
        // Serve an error page.
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
