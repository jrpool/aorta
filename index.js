/*
  index.js
  AORTA main script.
*/

// ########## IMPORTS

// Module to access files.
const fs = require('fs/promises');
// Module to perform accessibility tests.
const testaro = require('testaro');
// Module to create a web server.
const http = require('http');

// ########## GLOBAL CONSTANTS

const protocol = 'http';

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
      if (['/aorta', '/aorta/index.html'].includes(requestURL)) {
        // Add the page parameters to the query.
        const scriptNames = fs.readdirSync('scripts');
        const batchNames = fs.readdirSync('batches');
        query.scriptListSize = scriptNames.length;
        query.batchListSize = batchNames.length;
        query.scriptOptions = scriptNames.map(
          scriptName => `<option>${scriptName.slice(0, -5)}</option>`
        ).join('\n');
        query.batchOptions = batchNames.map(
          batchName => `<option>${batchName.slice(0, -5)}</option>`
        ).join('\n');
        // Serve the page.
        render('index', query, response);
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
      else if (requestURL === '/aorta/favicon.png') {
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
        // Fulfill the specifications.
        const log = [];
        const reports = [];
        const scriptJSON = fs.readFileSync(`scripts/${scriptName}.json`);
        const options = {
          log,
          reports,
          script: `${__readdir}/scripts/${scriptName}.json`
        };
        if (batchName) {
          options.batch = `${__readdir}/batches/${batchName}.json`;
        }
        const {handleRequest} = testaro;
        handleRequest(options);
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
};

// ########## SERVER

const server = http.createServer({}, requestHandler);

const serve = () => {
  // Environment variables are defined in Dockerfile.
  const port = process.env.PORT || '3005';
  server.listen(port, () => {
    console.log(`AORTA server listening at ${protocol}://localhost:${port}.`);
  });
};

serve();

// ########## PLATFORM

/**
 * @description Gracefully shut down Node and clean up.
 *
 */
 function shutdownNode() {

  console.log('Shutting down Node.');
  // Perform any cleanup.
  server.close(() => {
    process.exit(0);
  });
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
