'use client';

export default function ContactCustomer({ phone }: { phone?: string }) {
  const handleCopyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      alert('Phone number copied to clipboard');
    }
  };

  if (!phone) {
    return null;
  }

  return (
    <div className="flex gap-4">
      <a
        href={`tel:${phone}`}
        className="px-4 py-2 bg-[#32CE7A] hover:bg-[#2AB869] text-white font-semibold rounded-lg transition-colors"
      >
        Call {phone}
      </a>
      <button
        onClick={handleCopyPhone}
        className="px-4 py-2 bg-[#0A1A2F] border border-white/5 hover:border-[#32CE7A]/40 text-white font-semibold rounded-lg transition-colors"
      >
        Copy Phone
      </button>
    </div>
  );
}

