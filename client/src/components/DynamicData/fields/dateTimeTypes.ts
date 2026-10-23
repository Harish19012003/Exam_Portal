export type DynamicDateTimeVariant = 'editor' | 'form';

export interface DynamicDateTimeBaseProps {
  isDarkMode: boolean;
  variant?: DynamicDateTimeVariant;
  required?: boolean;
  placeholder?: string;
  className?: string;
  defaultOpen?: boolean;
  onCancel?: () => void;
  commitOnBlur?: boolean;
  disabled?: boolean;
  minMenuWidth?: number;
}

export interface DynamicDatePickerProps extends DynamicDateTimeBaseProps {
  value: string;
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
}

export interface DynamicDateTimePickerProps extends DynamicDateTimeBaseProps {
  value: string;
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
  minuteStep?: number;
}

export interface DynamicTimePickerProps extends DynamicDateTimeBaseProps {
  value: string;
  onChange: (value: string | null) => void;
  minuteStep?: number;
}
