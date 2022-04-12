/*
  script.js
  Aorta credential script.
*/

// Identify the element storing the SAML ID.
const samlIDElement = document.getElementById('samlID');
const pageID = samlIDElement.value;
// If there is only a placeholder SAML ID on the page:
if (pageID === '__samlID__') {
  // Get the stored SAML ID.
  const storedID = localStorage.getItem('samlID');
  // If it exists:
  if (storedID) {
    // Make it the value of the SAML ID element.
    samlIDElement.value = storedID;
  }
  // Otherwise, i.e. if no stored SAML ID exists either:
  else {
    // Remove the SAML ID element.
    samlIDElement.remove();
  }
}
// Otherwise, i.e. if there is a real SAML ID on the page:
else if (pageID) {
  // Update the stored SAML ID to it.
  localStorage.setItem('samlID', pageID);
}
