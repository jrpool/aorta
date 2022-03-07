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
const err = (error, context, response) => {
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
  render('error', query, response);
  return '';
};
// Serves content as a page.
const servePage = (content, location, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.setHeader('Content-Location', location);
  response.end(content);
};
// Replaces the placeholders in a page and serves the page.
const render = (nameBase, query, response) => {
  if (! response.writableEnded) {
    // Get the page.
    fs.readFile(`./${nameBase}.html`, 'utf8')
    .then(
      // When it arrives:
      page => {
        // Replace its placeholders with eponymous query parameters.
        const renderedPage = page.replace(/__([a-zA-Z]+)__/g, (ph, qp) => query[qp]);
        // Serve the page.
        servePage(renderedPage, `/aorta/${nameBase}.html`, response);
      },
      error => err(error, 'reading a page', response)
    );
  }
};
// Serves the stylesheet.
const serveStyles = response => {
  fs.readFile('style.css', 'utf8')
  .then(
    content => {
      response.setHeader('Content-Type', 'text/css');
      response.write(content);
      response.end();
    },
    error => err(error, 'reading stylesheet', response)
  );
};
// Serves a script.
const serveScript = (scriptName, response) => {
  fs.readFile(scriptName, 'utf8')
  .then(
    content => {
      response.setHeader('Content-Type', 'text/javascript');
      response.write(content);
      response.end();
    },
    error => err(error, 'reading script', response)
  );
};
// Serves the site icon.
const serveIcon = response => {
  fs.readFile('favicon.png')
  .then(
    content => {
      response.setHeader('Content-Type', 'image/png');
      response.write(content, 'binary');
      response.end();
    },
    error => err(error, 'reading site icon', response)
  );
};

// ==== REQUEST-PROCESSING UTILITIES ====

// Returns an order description.
const orderSpecs = order => `script ${order.scriptName}, batch ${order.batchName}`;
// Adds the orders, jobs, or testers to a query.
const addItems = async (query, itemType, isSelect) => {
  let size, key;
  let assignment = '';
  if (itemType === 'order') {
    size = 'orderListSize';
    key = 'orders';
    specs = item => orderSpecs(item);
  }
  else if (itemType === 'job') {
    size = 'jobListSize';
    key = 'jobs';
    specs = item => `${orderSpecs(item)}, tester ${item.tester}`;
  }
  else if (itemType = 'tester') {
    size = 'testerListSize';
    key = 'testers';
    specs = item => `${item.id}: ${item.name}`;
  }
  const itemNames = await fs.readdir(`.data/${key}`);
  const itemJSONs = [];
  for (const itemName of itemNames) {
    itemJSONs.push(await fs.readFile(`.data/${itemName}.json`));
  }
  query[size] = itemJSONs.length;
  query[key] = itemJSONs.map(itemJSON => {
    const item = JSON.parse(itemJSON);
    if (isSelect) {
      return `<option value="${item.id}">${item.id}: ${specs(item)}</li>`
    }
    else {
      return `<li>${item.id}: ${specs(item)}</li>`;
    }
  })
  .join('\n');
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
  .on('end', () => {
    // Remove any trailing slash from the URL.
    const requestURL = request.url.replace(/\/$/, '');
    // Initialize the query.
    const query = {};
    // METHOD GET: If the request requests a resource:
    if (method === 'GET') {
      // If the requested resource is the home page:
      if (requestURL === '/aorta') {
        // Serve the page.
        render('index', {}, response);
      }
      // Otherwise, if it is the ordering page:
      else if (requestURL === '/aorta/order') {
        // Add the page parameters to the query.
        fs.readdir('scripts')
        .then(scriptNames => {
          fs.readdir('batches')
          .then(batchNames => {
            query.scriptListSize = scriptNames.length;
            query.batchListSize = batchNames.length + 1;
            query.scriptOptions = scriptNames.map(
              scriptName => `<option>${scriptName.slice(0, -5)}</option>`
            ).join('\n');
            batchOptions = batchNames.map(batchName => `<option>${batchName.slice(0, -5)}</option>`);
            batchOptions.unshift('<option>None</option>');
            query.batchOptions = batchOptions.join('\n');
            // Serve the page.
            render('order', query, response);
          });
        });
      }
      // Otherwise, if it is the orders page:
      else if (requestURL === '/aorta/orders') {
        // Add the page parameters to the query.
        addItems(query, 'order', false);
        addItems(query, 'job', false);
        // Serve the page.
        render('orders', query, response);
      }
      // Otherwise, if it is the assignment page:
      else if (requestURL === '/aorta/assign') {
        // Add the page parameters to the query.
        addItems(query, 'order', true);
        addItems(query, 'tester', true);
        // Serve the page.
        render('assign', query, response);
      }
      // Otherwise, if it is the style sheet:
      else if (requestURL === '/aorta/style.css') {
        // Serve it.
        serveStyles(response);
      }
      // Otherwise, if it is the script:
      else if (requestURL === '/aorta/script.js') {
        // Serve it.
        serveScript('script.js', response);
      }
      // Otherwise, if it is the site icon:
      else if (requestURL.startsWith('/aorta/favicon.')) {
        // Serve it.
        serveIcon(response);
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
      const {scriptName, batchName} = bodyObject;
      // If the form is the home-page form and is valid:
      if (requestURL === '/aorta' && scriptName) {
        // Make Testaro perform the specified commands.
        const log = [];
        const reports = [];
        const {handleRequest} = testaro;
        fs.readFile(`scripts/${scriptName}.json`)
        .then(async scriptJSON => {
          const script = JSON.parse(scriptJSON);
          const options = {
            log,
            reports,
            script
          };
          if (batchName !== 'None') {
            fs.readFile(`batches/${batchName}.json`)
            .then(async batchJSON => {
              const batch = JSON.parse(batchJSON);
              options.batch = batch;
              await getTestaroResult(handleRequest, response, options);
            });
          }
          else {
            await getTestaroResult(handleRequest, response, options);
          }
          // Serve the result.
        });
      }
      // Otherwise, i.e. if the form is invalid:
      else {
        // Serve an error page.
        err('Invalid request submitted', 'in AORTA', response);
      }
    }
    // Otherwise, i.e. if the method is invalid:
    else {
      // Serve an error page.
      err('Unanticipated request method', 'in AORTA', response);
    }
  });
  request.on('close', () => {
    response.end();
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

const serve = () => {
  // Environment variables are defined in Dockerfile.
  const port = process.env.PORT || '3005';
  server.listen(port, () => {
    console.log(
      `Server listening at ${protocolName}://${process.env.HOST || 'localhost'}:${port}/aorta.`
    );
  });
};

serve();
console.log('Server started');

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
