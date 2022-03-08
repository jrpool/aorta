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
const servePage = (content, location, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.setHeader('Content-Location', location);
  response.end(content);
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
const orderSpecs = order => `script ${order.scriptName}, batch ${order.batchName}`;
// Adds the scripts, batches, orders, jobs, or testers to a query.
const addItems = async (query, itemType, isSelect) => {
  let size, key, dir, specs, addNone;
  if (itemType === 'script') {
    size = 'scriptListSize';
    key = 'scripts';
    dir = 'scripts';
    specs = item => item.what;
  }
  else if (itemType === 'batch') {
    size = 'batchListSize';
    key = 'batches';
    dir = 'batches';
    specs = item => item.what;
    addNone = true;
  }
  else if (itemType === 'order') {
    size = 'orderListSize';
    key = 'orders';
    dir = 'orders';
    specs = item => orderSpecs(item);
  }
  else if (itemType === 'job') {
    size = 'jobListSize';
    key = 'jobs';
    dir = 'jobs';
    specs = item => `${orderSpecs(item)}, tester ${item.tester}`;
  }
  else if (itemType = 'tester') {
    size = 'testerListSize';
    key = 'testers';
    dir = 'users';
    specs = item => `${item.id}: ${item.name}`;
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
    item.isValid = key === 'testers' ? item.roles.includes('test') : true;
    items.push(item);
  }
  if (addNone) {
    items.unshift({
      id: 'NONE',
      what: 'Do not use a batch',
      isValid: true
    });
  }
  query[size] = items.length;
  // Add an HTML string encoding options or list items to the query.
  query[key] = items.filter(item => item.isValid).map(item => {
    if (isSelect) {
      return `<option value="${item.id}">${item.id}: ${specs(item)}</li>`
    }
    else {
      return `<li>${item.id}: ${specs(item)}</li>`;
    }
  })
  .join('\n');
};
// Validates a user and, if valid, returns the user’s roles.
const userOK = async (userName, authCode, role) => {
  const userFileNames = await fs.readdir('.data/users');
  const userIndex = userFileNames.findIndex(fileName.slice(0, -5) === userName);
  if (userIndex > -1) {
    const userJSON = await fs.readFile(`.data/users/${userFileNames[userIndex]}`, 'utf8');
    const user = JSON.parse(userJSON);
    if (user.authCode === authCode && (! role || user.roles.includes(role))) {
      return user.roles;
    }
    else {
      return false;
    }
  }
  else {
    return false;
  }
};
// Writes an order.
const writeOrder = async (userName, options) => {
  const id = Math.floor((Date.now() - Date.UTC(2022, 1)) / 100).toString(36);
  const data = {
    id,
    userName,
    time: Date.now(),
    script: options.script
  };
  if (options.batch) {
    data.batch = options.batch;
  }
  await fs.writeFile(`.data/orders/${id}.json`, JSON.stringify(data, null, 2));
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
        // Serve the page.
        await render('order', query, response);
      }
      // Otherwise, if it is the orders page:
      else if (requestURL === '/aorta/orders') {
        // Add the page parameters to the query.
        addItems(query, 'order', false);
        addItems(query, 'job', false);
        // Serve the page.
        await render('orders', query, response);
      }
      // Otherwise, if it is the assignment page:
      else if (requestURL === '/aorta/assign') {
        // Add the page parameters to the query.
        addItems(query, 'order', true);
        addItems(query, 'tester', true);
        // Serve the page.
        await render('assign', query, response);
      }
      // Otherwise, if it is the reporting page:
      else if (requestURL === '/aorta/report') {
        // Add the page parameters to the query.
        addItems(query, 'job', false);
        // Serve the page.
        await render('report', query, response);
      }
      // Otherwise, if it is the report-retrieval page:
      else if (requestURL === '/aorta/get') {
        // Serve the page.
        await render('get', query, response);
      }
      // Otherwise, if it is the item-addition page:
      else if (requestURL === '/aorta/add') {
        // Serve the page.
        await render('add', query, response);
      }
      // Otherwise, if it is the style sheet:
      else if (requestURL === '/aorta/style.css') {
        // Serve it.
        serveResource('style.css', 'text/css', 'utf8', response);
      }
      // Otherwise, if it is the script:
      else if (requestURL === '/aorta/script.js') {
        // Serve it.
        serveResource('script.js', 'text/javascript', 'utf8', response);
      }
      // Otherwise, if it is the site icon:
      else if (requestURL.startsWith('/aorta/favicon.')) {
        // Serve it.
        serveResource('favicon.png', 'image/png', '', response);
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
      const {scriptName, batchName, userName, authCode} = bodyObject;
      // If the form submits an order and is valid:
      if (requestURL === '/aorta/order' && scriptName && userName && authCode) {
        // If the user is authorized to submit an order:
        if (await userOK(userName, authCode, 'order')) {
          const options = {};
          // Get the script.
          const scriptJSON = await fs.readFile(`scripts/${scriptName}.json`);
          options.script = JSON.parse(scriptJSON);
          // If a batch was specified:
          if (batchName !== 'None') {
            // Get it.
            const batchJSON = fs.readFile(`batches/${batchName}.json`);
            options.batch = JSON.parse(batchJSON);
            // Write the order.
            writeOrder(userName, options);
          }
          // Otherwise, i.e. if no batch was specified:
          else {
            // Write the order.
            writeOrder(userName, options);
          }
        }
      }
      // Otherwise, if the form assigns an order:
      else if (requestURL === '/aorta/assign') {
        // If the user is valid:
        const userRoles = await userOK(userName, authCode);
        if (userRoles) {
          // If the user has permission to read all orders and jobs:
          if (userRoles.includes('read')) {
            // Add them to the query.
            await addItems(query, 'order', true);
            await addItems(query, 'job', true);
            // Serve the selection page.
            await render('assign', query, response);
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
