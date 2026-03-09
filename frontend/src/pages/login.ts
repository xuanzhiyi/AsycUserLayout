import { setCurrentUser } from '../state';

export function createLoginPage(onLoginSuccess: (token: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page login-container';

  const card = document.createElement('div');
  card.className = 'login-card';

  const title = document.createElement('h2');
  title.textContent = 'Collaborative Case Management';
  card.appendChild(title);

  const demoInfo = document.createElement('div');
  demoInfo.className = 'demo-users';
  demoInfo.innerHTML = `
    <h3>Demo Users:</h3>
    <p><strong>UserA:</strong> user_a / pass_a</p>
    <p><strong>UserB:</strong> user_b / pass_b</p>
    <p><strong>UserC:</strong> user_c / pass_c</p>
  `;
  card.appendChild(demoInfo);

  const form = document.createElement('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = (form.querySelector('[name="username"]') as HTMLInputElement)?.value;
    const password = (form.querySelector('[name="password"]') as HTMLInputElement)?.value;

    if (!username || !password) {
      showError('Please enter username and password', form);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!data.success || !data.token || !data.user) {
        showError(data.message || 'Login failed', form);
        return;
      }

      // Save token and user info
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Update app state
      setCurrentUser({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        token: data.token,
      });

      // Trigger login success
      onLoginSuccess(data.token);
    } catch (error) {
      showError('Network error. Make sure backend is running.', form);
    }
  });

  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'form-group';
  const usernameLabel = document.createElement('label');
  usernameLabel.textContent = 'Username';
  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.name = 'username';
  usernameInput.placeholder = 'e.g., user_a';
  usernameInput.required = true;
  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);
  form.appendChild(usernameGroup);

  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';
  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'Password';
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.name = 'password';
  passwordInput.placeholder = 'e.g., pass_a';
  passwordInput.required = true;
  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  form.appendChild(passwordGroup);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Login';
  submitBtn.style.width = '100%';
  form.appendChild(submitBtn);

  card.appendChild(form);
  container.appendChild(card);

  return container;
}

function showError(message: string, parentElement: HTMLElement) {
  // Remove existing error
  const existing = parentElement.parentElement?.querySelector('.error');
  if (existing) existing.remove();

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;

  const parent = parentElement.parentElement;
  if (parent) {
    parent.insertBefore(errorDiv, parentElement);
  }
}
