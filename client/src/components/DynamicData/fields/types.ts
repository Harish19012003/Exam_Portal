export type DynamicDropdownVariant = 'editor' | 'form';

export interface DynamicDropdownBaseProps {
  isDarkMode: boolean;
  /** Open on mount (table cell auto-edit). */
  defaultOpen?: boolean;
  /** `editor` = table cell chrome; `form` = subtle form field chrome. */
  variant?: DynamicDropdownVariant;
  allowCustom?: boolean;
  placeholder?: string;
  className?: string;
  onCancel?: () => void;
  /** When true, commits current value on blur (table cell editing). */
  commitOnBlur?: boolean;
}

export interface DynamicDropdownProps extends DynamicDropdownBaseProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** When false, an empty "—" clear option is included. */
  required?: boolean;
  minMenuWidth?: number;
}

export interface DynamicMultiSelectDropdownProps extends DynamicDropdownBaseProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  minMenuWidth?: number;
}
