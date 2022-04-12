/*
  script.js
  Aorta credential script.
*/

// Get any stored credentials.
const storedID = localStorage.getItem('samlID');
// Populate the form with it.
if (storedID) {
  document.querySelector('input[name=samlID]').value = storedID;
}
// When the form is submitted:
document.body.querySelector('form').addEventListener('submit', () => {
  // Store the username and authorization code if different from those stored.
  const userNameInput = document.querySelector('input[name=userName]');
  const authCodeInput = document.querySelector('input[name=authCode]');
  const userName = userNameInput ? userNameInput.value : '';
  const authCode = authCodeInput ? authCodeInput.value : '';
  if (userName && userName !== storedUserName) {
    localStorage.setItem('userName', userName);
  }
  if (authCode && authCode !== storedAuthCode) {
    localStorage.setItem('authCode', authCode);
  }
});
