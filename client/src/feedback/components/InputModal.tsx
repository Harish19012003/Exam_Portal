import { useCallback, useState } from 'react';
import { Info, TextCursorInput, X } from 'lucide-react';
import { buildDefaultValues, validateInputFields } from '../inputPresets';
import {
  dismissButtonClass,
  feedbackModalShell,
  ICON_VARIANT_TOKENS,
  primaryButtonClass,
  secondaryButtonClass,
} from '../feedbackTokens';
import type { InputFieldSchema, InputItem } from '../types';

const inputCls = (isDarkMode: boolean, hasError: boolean) =>
  `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors
    ${hasError
      ? 'border-red-500 focus:border-red-500'
      : isDarkMode
        ? 'bg-gray-900 border-gray-600 text-gray-100 focus:border-[#13C296]'
        : 'bg-white border-gray-200 text-gray-900 focus:border-[#13C296]'}`;

function FieldControl({
  field,
  value,
  error,
  isDarkMode,
  onChange,
}: {
  field: InputFieldSchema;
  value: string | boolean;
  error?: string;
  isDarkMode: boolean;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-[#13C296] focus:ring-[#13C296]"
        />
        <span className={`text-[13px] ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {field.label}
        </span>
      </label>
    );
  }

  const stringValue = typeof value === 'string' ? value : '';

  if (field.type === 'select') {
    return (
      <div className="space-y-1">
        <label className={`block text-[12px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          value={stringValue}
          onChange={e => onChange(e.target.value)}
          className={inputCls(isDarkMode, Boolean(error))}
        >
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1">
        <label className={`block text-[12px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <textarea
          value={stringValue}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputCls(isDarkMode, Boolean(error))} resize-none`}
        />
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className={`block text-[12px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
        value={stringValue}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={inputCls(isDarkMode, Boolean(error))}
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

interface InputModalProps {
  input: InputItem;
  isDarkMode: boolean;
  onDismiss: () => void;
}

export function InputModal({ input, isDarkMode, onDismiss }: InputModalProps) {
  const fields = input.fields ?? [];
  const [values, setValues] = useState(() => buildDefaultValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCancel = useCallback(() => {
    input.onCancel?.();
    onDismiss();
  }, [input, onDismiss]);

  const handleSubmit = useCallback(() => {
    const nextErrors = validateInputFields(
      fields,
      values,
      input.validateOnSubmit,
      input.validate,
    );
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    input.onSubmit?.(values);
    onDismiss();
  }, [fields, values, input, onDismiss]);

  const setFieldValue = (key: string, value: string | boolean) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const infoStyles = ICON_VARIANT_TOKENS.info;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`input-title-${input.id}`}
      className={`w-full rounded-2xl border shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]
        ${feedbackModalShell(isDarkMode)}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${infoStyles.iconBg}`}>
          {input.name === 'input.prompt' ? (
            <TextCursorInput className={`w-5 h-5 ${infoStyles.iconColor}`} strokeWidth={2.5} />
          ) : (
            <Info className={`w-5 h-5 ${infoStyles.iconColor}`} strokeWidth={2.5} />
          )}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {input.title && (
            <p
              id={`input-title-${input.id}`}
              className={`text-[15px] font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
            >
              {input.title}
            </p>
          )}
          {input.message && (
            <p className={`text-[13px] mt-1.5 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {input.message}
            </p>
          )}
          {(input.tertiary ?? input.description) && (
            <p className={`text-[12px] mt-2 leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {input.tertiary ?? input.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className={dismissButtonClass(isDarkMode)}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 pb-4 space-y-3">
        {fields.map(field => (
          <FieldControl
            key={field.key}
            field={field}
            value={values[field.key] ?? (field.type === 'checkbox' ? false : '')}
            error={errors[field.key]}
            isDarkMode={isDarkMode}
            onChange={v => setFieldValue(field.key, v)}
          />
        ))}
      </div>

      <div className="px-5 pb-5 flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className={secondaryButtonClass(isDarkMode, 'flex-1')}
        >
          {input.cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className={primaryButtonClass('flex-1')}
        >
          {input.submitLabel ?? 'Submit'}
        </button>
      </div>
    </div>
  );
}
