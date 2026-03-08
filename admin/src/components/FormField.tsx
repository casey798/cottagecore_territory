import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  children?: React.ReactNode;
}

type InputFieldProps = FormFieldProps &
  InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };

type TextareaFieldProps = FormFieldProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };

type Props = InputFieldProps | TextareaFieldProps;

export function FormField({ label, error, children, ...rest }: Props) {
  const inputClasses =
    'w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none';

  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
        {label}
      </label>
      {children ? (
        children
      ) : rest.as === 'textarea' ? (
        <textarea
          className={inputClasses}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className={inputClasses}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
