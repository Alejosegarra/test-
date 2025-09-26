import React from 'react';
import { XIcon } from './Icons';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
};

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400 dark:text-slate-300 dark:hover:bg-slate-700',
  };

  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};


export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
    return (
        <input 
            {...props} 
            ref={ref}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-100 bg-white text-gray-900 placeholder:text-gray-500 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 dark:border-slate-600 dark:focus:ring-blue-500 dark:focus:border-blue-500 ${props.className || ''}`}
        />
    );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => {
    return (
        <select
            {...props}
            ref={ref}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 ${props.className || ''}`}
        >
            {props.children}
        </select>
    );
});

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input
        type="checkbox"
        ref={ref}
        className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer dark:bg-slate-600 dark:border-slate-500 ${className || ''}`}
        {...props}
    />
));


type CardProps = {
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<'div'>;

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden dark:bg-slate-800 dark:border dark:border-slate-700 ${className || ''}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => {
    return <div className={`p-4 border-b border-gray-200 dark:border-slate-700 ${className}`}>{children}</div>;
};

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => {
    return <div className={`p-4 ${className}`}>{children}</div>;
};


type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
};

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <XIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const formatDateForDisplay = (isoDate: string): string => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const parseDateFromDisplay = (displayDate: string): string => {
    const parts = displayDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!parts) return '';
    
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);

    if (year < 1900 || year > 2100) return '';

    const date = new Date(year, month - 1, day);
    
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return '';
};

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
    value: string; // Expects YYYY-MM-DD
    onChange: (value: string) => void; // Emits YYYY-MM-DD
};

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(({ value, onChange, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(formatDateForDisplay(value));

    React.useEffect(() => {
        const formatted = formatDateForDisplay(value);
        if (formatted !== displayValue) {
           setDisplayValue(formatted);
        }
    }, [value]);

    const handleDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const isoDate = parseDateFromDisplay(e.target.value);
        if (isoDate) {
            onChange(isoDate);
            setDisplayValue(formatDateForDisplay(isoDate));
        } else if (e.target.value === '') {
            onChange('');
        } else {
            setDisplayValue(formatDateForDisplay(value));
        }
        
        if (onBlur) {
            onBlur(e);
        }
    };

    return (
        <Input
            ref={ref}
            type="text"
            placeholder="dd/mm/yyyy"
            value={displayValue}
            onChange={handleDisplayChange}
            onBlur={handleBlur}
            maxLength={10}
            {...props}
        />
    );
});

type SearchableSelectOption = { value: string; label: string };

export const SearchableSelect = React.forwardRef<
  HTMLInputElement,
  {
    options: SearchableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }
>(({ options, value, onChange, placeholder, disabled }, ref) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(() => options.find(opt => opt.value === value), [options, value]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={isOpen ? searchTerm : (selectedOption?.label || '')}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => {
            setIsOpen(true);
            setSearchTerm('');
        }}
        onClick={() => {
            if(!isOpen) {
                setIsOpen(true);
                setSearchTerm('');
            }
        }}
        disabled={disabled}
        autoComplete="off"
      />
      {isOpen && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <ul>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <li
                  key={option.value}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 ${option.value === value ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                  onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(option.value);
                  }}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-gray-500 dark:text-slate-400">No se encontraron resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});