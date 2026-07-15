function getToken() {
  return localStorage.getItem('taverna_token');
}

function getUser() {
  const raw = localStorage.getItem('taverna_user');
  return raw ? JSON.parse(raw) : null;
}

function logout() {
  localStorage.removeItem('taverna_token');
  localStorage.removeItem('taverna_user');
  window.location.reload();
}

function renderAuthNav() {
  const nav = document.querySelector('header nav');
  if (!nav) return;

  // Remove links antigos de auth se existirem, pra não duplicar
  nav.querySelectorAll('.auth-link').forEach(el => el.remove());

  const token = getToken();
  const user = getUser();

  const isInPages = window.location.pathname.includes('/pages/');
  const prefix = isInPages ? '' : 'pages/';

  if (token && user) {
    const friendsLink = document.createElement('a');
    friendsLink.className = 'auth-link';
    friendsLink.href = `${prefix}friends.html`;
    friendsLink.textContent = 'Friends';

    const groupsLink = document.createElement('a');
    groupsLink.className = 'auth-link';
    groupsLink.href = `${prefix}groups.html`;
    groupsLink.textContent = 'Groups';

    const chatLink = document.createElement('a');
    chatLink.className = 'auth-link';
    chatLink.href = `${prefix}chat.html`;
    chatLink.textContent = 'Chat';

    const profileLink = document.createElement('a');
    profileLink.className = 'auth-link';
    profileLink.href = `${prefix}profile.html`;
    profileLink.textContent = 'My Profile';

    const userSpan = document.createElement('span');
    userSpan.className = 'auth-link';
    userSpan.textContent = `👤 ${user.email}`;
    userSpan.style.marginLeft = '10px';

    const logoutLink = document.createElement('a');
    logoutLink.className = 'auth-link';
    logoutLink.href = '#';
    logoutLink.textContent = 'Logout';
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });

    nav.appendChild(friendsLink);
    nav.appendChild(chatLink);
    nav.appendChild(groupsLink);
    nav.appendChild(profileLink);
    nav.appendChild(userSpan);
    nav.appendChild(logoutLink);
  } else {
    const loginLink = document.createElement('a');
    loginLink.className = 'auth-link';
    loginLink.href = `${prefix}login.html`;
    loginLink.textContent = 'Log In';

    const registerLink = document.createElement('a');
    registerLink.className = 'auth-link';
    registerLink.href = `${prefix}register.html`;
    registerLink.textContent = 'Sign Up';

    nav.appendChild(loginLink);
    nav.appendChild(registerLink);
  }
}

renderAuthNav();
