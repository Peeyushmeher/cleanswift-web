'use client';

interface JobMapProps {
  address: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  province?: string;
}

export default function JobMap({ address, latitude, longitude, city, province }: JobMapProps) {
  // Generate Google Maps embed URL
  const getMapUrl = () => {
    if (latitude && longitude) {
      return `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
    }
    // Fallback to address search
    const query = encodeURIComponent(`${address}, ${city}, ${province}`);
    return `https://www.google.com/maps?q=${query}&z=15&output=embed`;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Location</h3>
      <div className="text-[#C6CFD9] mb-4">
        <div>{address}</div>
        {city && province && (
          <div>
            {city}, {province}
          </div>
        )}
      </div>
      <div className="w-full h-64 rounded-lg overflow-hidden border border-white/5">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={getMapUrl()}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${city}, ${province}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-[#32CE7A] hover:text-[#6FF0C4] text-sm font-medium"
      >
        Open in Google Maps →
      </a>
    </div>
  );
}

