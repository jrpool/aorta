/*
  bulkToAorta.js
  File-selection handler.
*/

// When the user selects a file:
const fileInput = document.getElementById('fileName');
fileInput.addEventListener('change', async () => {
  // Make its content the value of the dataJSON query parameter.
  const dataJSON = await fileInput.files[0].text();
  document.getElementById('dataJSON').value = dataJSON;
});
