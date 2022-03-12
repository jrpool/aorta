/*
  script.js
  Aorta credential script.
*/

// Get any stored credentials.
const storedUserName = localStorage.getItem('userName');
const storedAuthCode = localStorage.getItem('authCode');
// Populate the form with them.
if (storedUserName) {
  document.querySelector('input[name=userName]').value = storedUserName;
}
if (storedAuthCode) {
  document.body.querySelector('input[name=authCode]').value = storedAuthCode;
}
// When the form is submitted:
document.body.querySelector('form').onsubmit = () => {
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
};
