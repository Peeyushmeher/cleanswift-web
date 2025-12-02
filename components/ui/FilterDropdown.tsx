'use client';

import { useState } from 'react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
  multiple?: boolean;
  className?: string;
}

export default function FilterDropdown({
  label,
  options,
  value,
  onChange,
  multiple = false,
  className = '',
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-[#050B12] border border-white/5 rounded-lg text-left text-white flex items-center justify-between hover:border-[#32CE7A]/40 transition-colors"
      >
        <span className="text-sm">
          {selectedOption ? selectedOption.label : label}
        </span>
        <svg
          className={`w-5 h-5 text-[#C6CFD9] transform transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-2 bg-[#0A1A2F] border border-white/5 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  if (!multiple) {
                    setIsOpen(false);
                  }
                }}
                className={`
                  w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors
                  ${
                    value === option.value
                      ? 'bg-[#32CE7A]/20 text-[#32CE7A]'
                      : 'text-white'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

