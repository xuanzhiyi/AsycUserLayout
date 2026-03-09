import { getState, updateCasesList } from '../state';
import { onActiveEditorsUpdate } from '../socket-client';

export function createCaseListPage(onCaseSelect: (caseId: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page';

  const content = document.createElement('div');
  content.className = 'container';

  const title = document.createElement('h2');
  title.textContent = 'Cases';
  title.style.marginBottom = '20px';
  content.appendChild(title);

  const caseListContainer = document.createElement('div');
  caseListContainer.className = 'case-list';
  caseListContainer.id = 'case-list';
  content.appendChild(caseListContainer);

  container.appendChild(content);

  // Fetch and display cases
  loadCases(caseListContainer, onCaseSelect);

  // Listen for active editors updates
  const handleEditorsUpdate = (data: any) => {
    const caseCard = caseListContainer.querySelector(`[data-case-id="${data.caseId}"]`);
    if (caseCard) {
      updateCaseCardEditors(caseCard as HTMLElement, data.activeEditors);
    }
  };

  onActiveEditorsUpdate(handleEditorsUpdate);

  return container;
}

async function loadCases(container: HTMLElement, onCaseSelect: (caseId: string) => void) {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const response = await fetch('/api/cases', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!data.success || !data.data) return;

    updateCasesList(data.data);
    renderCases(container, data.data, onCaseSelect);
  } catch (error) {
    console.error('Error loading cases:', error);
  }
}

function renderCases(container: HTMLElement, cases: any[], onCaseSelect: (caseId: string) => void) {
  container.innerHTML = '';

  cases.forEach((caseItem) => {
    const card = document.createElement('div');
    card.className = 'case-card';
    card.setAttribute('data-case-id', caseItem.id);
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => onCaseSelect(caseItem.id));

    const header = document.createElement('div');
    header.className = 'case-header';

    const titleEl = document.createElement('h3');
    titleEl.className = 'case-title';
    titleEl.textContent = caseItem.title;
    header.appendChild(titleEl);

    const status = document.createElement('span');
    status.className = `case-status ${caseItem.status}`;
    status.textContent = caseItem.status.replace('_', ' ').toUpperCase();
    header.appendChild(status);

    card.appendChild(header);

    const description = document.createElement('p');
    description.className = 'case-description';
    description.textContent = caseItem.description;
    card.appendChild(description);

    const editors = document.createElement('div');
    editors.className = 'active-editors';
    if (caseItem.activeEditors && caseItem.activeEditors.length > 0) {
      caseItem.activeEditors.forEach((editor: string) => {
        const badge = document.createElement('div');
        badge.className = 'editor-badge active';
        badge.innerHTML = `<span>●</span> ${editor}`;
        editors.appendChild(badge);
      });
    } else {
      const noBadge = document.createElement('div');
      noBadge.style.color = '#999';
      noBadge.style.fontSize = '12px';
      noBadge.textContent = 'No one editing';
      editors.appendChild(noBadge);
    }
    card.appendChild(editors);

    container.appendChild(card);
  });
}

function updateCaseCardEditors(card: HTMLElement, editors: string[]) {
  const editorsContainer = card.querySelector('.active-editors');
  if (!editorsContainer) return;

  editorsContainer.innerHTML = '';

  if (editors.length > 0) {
    editors.forEach((editor: string) => {
      const badge = document.createElement('div');
      badge.className = 'editor-badge active';
      badge.innerHTML = `<span>●</span> ${editor}`;
      editorsContainer.appendChild(badge);
    });
  } else {
    const noBadge = document.createElement('div');
    noBadge.style.color = '#999';
    noBadge.style.fontSize = '12px';
    noBadge.textContent = 'No one editing';
    editorsContainer.appendChild(noBadge);
  }
}
