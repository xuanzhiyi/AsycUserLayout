import { getState, setCurrentUser, setCurrentCase, resetState } from './state';
import { initSocketConnection, disconnectSocket, emitUserConnect } from './socket-client';
import { createLoginPage } from './pages/login';
import { createCaseListPage } from './pages/case-list';
import { createCaseDetailsPage } from './pages/case-details';

type PageType = 'login' | 'case-list' | 'case-details';

let currentPage: PageType = 'login';
let currentCaseId: string | null = null;

const app = document.querySelector('#app') as HTMLElement;

// Initialize app
function init() {
  const token = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('user');

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      setCurrentUser({ ...user, token });
      showCaseListPage();
    } catch (error) {
      showLoginPage();
    }
  } else {
    showLoginPage();
  }
}

function showLoginPage() {
  currentPage = 'login';
  app.innerHTML = '';

  const loginPage = createLoginPage((token) => {
    const state = getState();
    const user = state.currentUser;
    // Initialize socket connection
    if (user) {
      initSocketConnection(token, { userId: user.id, username: user.username });
    }

    // Move to case list
    showCaseListPage();
  });

  app.appendChild(loginPage);

  // Create header for consistency
  createHeader(true);
}

function showCaseListPage() {
  currentPage = 'case-list';
  disconnectSocket();

  app.innerHTML = '';

  const state = getState();
  const user = state.currentUser;

  if (!user) {
    showLoginPage();
    return;
  }

  // Initialize socket connection
  initSocketConnection(user.token, { userId: user.id, username: user.username });

  const caseListPage = createCaseListPage((caseId) => {
    currentCaseId = caseId;
    showCaseDetailsPage(caseId);
  });

  app.appendChild(caseListPage);
  createHeader();
}

function showCaseDetailsPage(caseId: string) {
  currentPage = 'case-details';
  currentCaseId = caseId;

  const state = getState();
  const user = state.currentUser;

  if (!user) {
    showLoginPage();
    return;
  }

  // Make sure socket is connected
  const socket = initSocketConnection(user.token, { userId: user.id, username: user.username });

  app.innerHTML = '';

  const caseDetailsPage = createCaseDetailsPage(caseId, () => {
    showCaseListPage();
  });

  app.appendChild(caseDetailsPage);
  createHeader();
}

function createHeader(hideLogout = false) {
  const state = getState();
  const user = state.currentUser;

  if (!user || hideLogout) return;

  // Remove existing header if it exists
  const existingHeader = document.querySelector('.header');
  if (existingHeader) {
    existingHeader.remove();
  }

  const headerDiv = document.createElement('div');
  headerDiv.className = 'header';

  const headerContent = document.createElement('div');
  headerContent.className = 'header-content';

  const title = document.createElement('h1');
  title.textContent = 'Collaborative Case Management';
  headerContent.appendChild(title);

  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';

  const userBadge = document.createElement('div');
  userBadge.className = 'user-badge';
  userBadge.textContent = `${user.username} (${user.email})`;
  userInfo.appendChild(userBadge);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'logout-btn';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    resetState();
    disconnectSocket();
    showLoginPage();
  });
  userInfo.appendChild(logoutBtn);

  headerContent.appendChild(userInfo);
  headerDiv.appendChild(headerContent);

  document.body.insertBefore(headerDiv, document.body.firstChild);
}

// Start the app
init();

// Handle browser back button
window.addEventListener('popstate', () => {
  if (currentPage === 'case-details') {
    showCaseListPage();
  }
});
