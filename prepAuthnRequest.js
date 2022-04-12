/*
  prepAuthnRequest.js
  Conversion of authnRequest.xml to a query parameter.
*/

// ########## IMPORTS

// Modules to access files.
const fs = require('fs').promises;
const zlib = require('zlib');

// ########## FUNCTIONS

// Returns the Base64 encoding of a string.
const b64Of = string => Buffer.from(string).toString('base64');
/*
  Converts authnRequest.xml to authnRequest.txt and saves it.
  The new file is deflated, then Base64-encoded, then URL-encoded.
  The URL encoding uses encodeURIComponent, which is identical to URL encoding for the set of
  characters that can exist in a Base64 encoding. The Base64 encoding performed by Buffer
  contains only alphanumerics and ['-', '_', '+', '/', '=']. Of these, only ['+', '/', '=']
  need URL encoding.
*/
const convert = async () => {
  const original = await fs.readFile('data/saml/authnRequest.xml', 'utf8');
  const deflation = zlib.deflateRawSync(original);
  const b64 = b64Of(deflation);
  const urlEncoding = encodeURIComponent(b64);
  await fs.writeFile('data/saml/authnRequest.txt', urlEncoding);
}
// ########## OPERATION

convert();
