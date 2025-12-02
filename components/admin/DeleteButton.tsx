'use client';

import { useTransition } from 'react';

interface DeleteButtonProps {
  action: (formData: FormData) => Promise<void>;
  id: string;
  itemName: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function DeleteButton({ action, id, itemName, className, size = 'md' }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (confirm(`Delete this ${itemName}? This cannot be undone.`)) {
      const formData = new FormData();
      formData.append('id', id);
      startTransition(() => {
        action(formData);
      });
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${sizeClasses} text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 ${className || ''}`}
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}

