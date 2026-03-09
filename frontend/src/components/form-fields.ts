import { FieldType, CaseField } from '../../shared/types';

export interface FormFieldConfig {
  field: CaseField;
  isLocked: boolean;
  lockedByUsername?: string;
  presenceUsers: Array<{ userId: string; username: string }>;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: any) => void;
  isSaving?: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export function createFormField(config: FormFieldConfig): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field-wrapper';
  if (['textarea'].includes(config.field.fieldType)) {
    wrapper.classList.add('full-width');
  }

  const label = document.createElement('label');
  label.className = 'form-field-label';
  label.textContent = config.field.fieldName;
  wrapper.appendChild(label);

  const container = document.createElement('div');
  container.style.position = 'relative';

  let input: HTMLElement;

  switch (config.field.fieldType) {
    case 'text':
      input = createTextInput(config);
      break;
    case 'textarea':
      input = createTextAreaInput(config);
      break;
    case 'number':
      input = createNumberInput(config);
      break;
    case 'datetime':
      input = createDateTimeInput(config);
      break;
    case 'checkbox':
      input = createCheckboxInput(config);
      break;
    case 'dropdown':
      input = createDropdownInput(config);
      break;
    case 'slider':
      input = createSliderInput(config);
      break;
    case 'radio':
      input = createRadioInput(config);
      break;
    default:
      input = createTextInput(config);
  }

  container.appendChild(input);

  // Add lock indicator
  if (config.isLocked) {
    const lockIndicator = document.createElement('div');
    lockIndicator.className = 'field-lock-indicator';
    lockIndicator.innerHTML = `
      <div class="lock-icon">🔒</div>
      <span>${config.lockedByUsername}</span>
    `;
    container.appendChild(lockIndicator);
  }

  // Add presence avatars
  if (config.presenceUsers.length > 0) {
    const presenceContainer = document.createElement('div');
    presenceContainer.className = 'field-presence';
    config.presenceUsers.forEach((user) => {
      const avatar = document.createElement('div');
      avatar.className = 'presence-avatar';
      avatar.textContent = user.username.charAt(0).toUpperCase();
      avatar.title = user.username;
      presenceContainer.appendChild(avatar);
    });
    container.appendChild(presenceContainer);
  }

  wrapper.appendChild(container);

  // Add save status
  if (config.saveStatus && config.saveStatus !== 'idle') {
    const statusEl = document.createElement('div');
    statusEl.className = `save-status ${config.saveStatus}`;
    if (config.saveStatus === 'saving') statusEl.textContent = 'Saving...';
    if (config.saveStatus === 'saved') statusEl.textContent = 'Saved';
    if (config.saveStatus === 'error') statusEl.textContent = 'Save failed';
    wrapper.appendChild(statusEl);
  }

  return wrapper;
}

function createTextInput(config: FormFieldConfig): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-field-input';
  input.value = String(config.field.value || '');
  input.disabled = config.isLocked;
  input.addEventListener('focus', config.onFocus);
  input.addEventListener('blur', config.onBlur);
  input.addEventListener('input', (e) => config.onChange((e.target as HTMLInputElement).value));
  return input;
}

function createTextAreaInput(config: FormFieldConfig): HTMLElement {
  const textarea = document.createElement('textarea');
  textarea.className = 'form-field-input';
  textarea.value = String(config.field.value || '');
  textarea.rows = 4;
  textarea.disabled = config.isLocked;
  textarea.addEventListener('focus', config.onFocus);
  textarea.addEventListener('blur', config.onBlur);
  textarea.addEventListener('input', (e) => config.onChange((e.target as HTMLTextAreaElement).value));
  return textarea;
}

function createNumberInput(config: FormFieldConfig): HTMLElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'form-field-input';
  input.value = String(config.field.value || '');
  input.disabled = config.isLocked;
  input.addEventListener('focus', config.onFocus);
  input.addEventListener('blur', config.onBlur);
  input.addEventListener('input', (e) => config.onChange((e.target as HTMLInputElement).value));
  return input;
}

function createDateTimeInput(config: FormFieldConfig): HTMLElement {
  const input = document.createElement('input');
  input.type = 'datetime-local';
  input.className = 'form-field-input';
  input.value = String(config.field.value || '');
  input.disabled = config.isLocked;
  input.addEventListener('focus', config.onFocus);
  input.addEventListener('blur', config.onBlur);
  input.addEventListener('change', (e) => config.onChange((e.target as HTMLInputElement).value));
  return input;
}

function createCheckboxInput(config: FormFieldConfig): HTMLElement {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'form-field-input';
  input.checked = config.field.value === true || config.field.value === 'true';
  input.disabled = config.isLocked;
  input.addEventListener('focus', config.onFocus);
  input.addEventListener('blur', config.onBlur);
  input.addEventListener('change', (e) => config.onChange((e.target as HTMLInputElement).checked));

  const label = document.createElement('label');
  label.textContent = 'Yes';
  label.style.margin = '0';
  label.style.fontWeight = '400';

  container.appendChild(input);
  container.appendChild(label);

  return container;
}

function createDropdownInput(config: FormFieldConfig): HTMLElement {
  const select = document.createElement('select');
  select.className = 'form-field-input';
  select.disabled = config.isLocked;

  const options = ['', 'High', 'Medium', 'Low', 'Critical'];
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt || 'Select...';
    select.appendChild(option);
  });

  select.value = String(config.field.value || '');
  select.addEventListener('focus', config.onFocus);
  select.addEventListener('blur', config.onBlur);
  select.addEventListener('change', (e) => config.onChange((e.target as HTMLSelectElement).value));

  return select;
}

function createSliderInput(config: FormFieldConfig): HTMLElement {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '10px';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'form-field-input';
  input.style.flex = '1';
  input.min = '0';
  input.max = '100';
  input.value = String(config.field.value || '0');
  input.disabled = config.isLocked;
  input.addEventListener('focus', config.onFocus);
  input.addEventListener('blur', config.onBlur);
  input.addEventListener('input', (e) => config.onChange((e.target as HTMLInputElement).value));

  const valueDisplay = document.createElement('span');
  valueDisplay.textContent = `${config.field.value || 0}%`;
  valueDisplay.style.minWidth = '40px';
  valueDisplay.style.textAlign = 'right';

  input.addEventListener('input', (e) => {
    valueDisplay.textContent = `${(e.target as HTMLInputElement).value}%`;
  });

  container.appendChild(input);
  container.appendChild(valueDisplay);

  return container;
}

function createRadioInput(config: FormFieldConfig): HTMLElement {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '20px';

  const options = ['Open', 'In Progress', 'Closed'];
  options.forEach((opt) => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `radio-${config.field.id}`;
    radio.value = opt;
    radio.disabled = config.isLocked;
    radio.checked = config.field.value === opt;
    radio.addEventListener('focus', config.onFocus);
    radio.addEventListener('blur', config.onBlur);
    radio.addEventListener('change', (e) => config.onChange((e.target as HTMLInputElement).value));

    const label = document.createElement('label');
    label.textContent = opt;
    label.style.margin = '0';
    label.style.fontWeight = '400';

    wrapper.appendChild(radio);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });

  return container;
}
