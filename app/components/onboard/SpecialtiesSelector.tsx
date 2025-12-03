'use client';

interface SpecialtiesSelectorProps {
  selected: string[];
  onChange: (specialties: string[]) => void;
}

const AVAILABLE_SPECIALTIES = [
  'Interior Detailing',
  'Exterior Detailing',
  'Full Detail',
  'Ceramic Coating',
  'Paint Correction',
  'Engine Bay Cleaning',
  'Headlight Restoration',
  'Odor Removal',
  'Leather Conditioning',
  'Vinyl Wrap',
  'Window Tinting',
  'Paint Protection Film',
];

export default function SpecialtiesSelector({ selected, onChange }: SpecialtiesSelectorProps) {
  const toggleSpecialty = (specialty: string) => {
    if (selected.includes(specialty)) {
      onChange(selected.filter(s => s !== specialty));
    } else {
      onChange([...selected, specialty]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-4">
        Select Your Specialties <span className="text-slate-500">(optional)</span>
      </label>
      <p className="text-slate-400 text-sm mb-6">
        Select all services you specialize in. This helps customers find the right detailer for their needs.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {AVAILABLE_SPECIALTIES.map((specialty) => {
          const isSelected = selected.includes(specialty);
          return (
            <label
              key={specialty}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSpecialty(specialty)}
                className="sr-only"
              />
              <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                isSelected
                  ? 'bg-cyan-500 border-cyan-500'
                  : 'border-slate-600'
              }`}>
                {isSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              <span className="text-sm">{specialty}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
