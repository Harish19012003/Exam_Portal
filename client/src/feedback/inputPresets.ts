import type { FeedbackComponentName } from './registry';
import type { InputFieldSchema, InputShowOptions, ToastVariant } from './types';

interface InputPreset extends InputShowOptions {
  variant: ToastVariant;
}

const MULTI_FIELDS: InputFieldSchema[] = [
  {
    key: 'name',
    label: 'Full name',
    type: 'text',
    placeholder: 'Jane Doe',
    required: true,
  },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: [
      { label: 'Viewer', value: 'viewer' },
      { label: 'Editor', value: 'editor' },
      { label: 'Admin', value: 'admin' },
    ],
    defaultValue: 'viewer',
  },
  {
    key: 'notify',
    label: 'Send email notifications',
    type: 'checkbox',
    defaultValue: true,
  },
];

const VALIDATION_FIELDS: InputFieldSchema[] = [
  {
    key: 'email',
    label: 'Email address',
    type: 'email',
    placeholder: 'you@example.com',
    required: true,
  },
  {
    key: 'phone',
    label: 'Phone number',
    type: 'text',
    placeholder: '+1 (555) 000-0000',
    required: true,
  },
];

export const INPUT_PRESETS: Partial<Record<FeedbackComponentName, InputPreset>> = {
  'input.single': {
    variant: 'info',
    title: 'Add note',
    message: 'Enter a note for this record.',
    tertiary: 'Notes are visible to your team members.',
    fields: [
      {
        key: 'note',
        label: 'Note',
        type: 'text',
        placeholder: 'Type your note here…',
      },
    ],
    submitLabel: 'Save',
    cancelLabel: 'Cancel',
  },
  'input.multi': {
    variant: 'info',
    title: 'Edit profile',
    message: 'Update the fields below.',
    tertiary: 'Changes take effect immediately.',
    fields: MULTI_FIELDS,
    submitLabel: 'Save changes',
    cancelLabel: 'Cancel',
  },
  'input.validation': {
    variant: 'warning',
    title: 'Contact details',
    message: 'All fields marked required must be filled in.',
    tertiary: 'We use this information for account recovery.',
    fields: VALIDATION_FIELDS,
    validateOnSubmit: true,
    submitLabel: 'Submit',
    cancelLabel: 'Cancel',
  },
  'input.prompt': {
    variant: 'info',
    title: 'Enter value',
    message: 'Please provide a name for this item.',
    fields: [
      {
        key: 'value',
        label: 'Name',
        type: 'text',
        placeholder: 'Enter name…',
        required: true,
      },
    ],
    validateOnSubmit: true,
    submitLabel: 'OK',
    cancelLabel: 'Cancel',
  },
};

export function resolveInputShow(
  name: FeedbackComponentName,
  overrides?: InputShowOptions,
): InputPreset & InputShowOptions {
  const preset = INPUT_PRESETS[name];
  if (!preset) {
    return {
      variant: 'info',
      title: 'Preview',
      message: `${name} is not implemented yet.`,
      fields: [],
      submitLabel: 'Submit',
      cancelLabel: 'Cancel',
      ...overrides,
    };
  }
  return { ...preset, ...overrides };
}

export function isInputName(name: FeedbackComponentName): boolean {
  return name.startsWith('input.');
}

export function buildDefaultValues(fields: InputFieldSchema[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    if (field.type === 'checkbox') {
      values[field.key] = field.defaultValue ?? false;
    } else {
      values[field.key] = (field.defaultValue as string | undefined) ?? '';
    }
  }
  return values;
}

export function validateInputFields(
  fields: InputFieldSchema[],
  values: Record<string, string | boolean>,
  validateOnSubmit?: boolean,
  customValidate?: InputShowOptions['validate'],
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (validateOnSubmit) {
    for (const field of fields) {
      if (!field.required) continue;
      const value = values[field.key];
      if (field.type === 'checkbox') continue;
      if (typeof value !== 'string' || value.trim() === '') {
        errors[field.key] = `${field.label} is required`;
      }
    }
  }

  if (customValidate) {
    const customErrors = customValidate(values);
    if (customErrors) {
      Object.assign(errors, customErrors);
    }
  }

  return errors;
}
