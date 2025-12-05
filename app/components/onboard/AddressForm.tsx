'use client';

import { useState, useEffect, useRef } from 'react';
import type { AddressData } from '@/app/onboard/actions';

interface AddressFormProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  errors?: Partial<Record<keyof AddressData, string>>;
}

declare global {
  interface Window {
    google: any;
    initGooglePlaces: () => void;
  }
}

export default function AddressForm({ value, onChange, errors }: AddressFormProps) {
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // Keep refs in sync
  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  }, [onChange, value]);

  // Check if Google Places API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google?.maps?.places) {
        setIsScriptLoaded(true);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkGoogleMaps()) {
      return;
    }

    // Poll for script loading (in case it's loading from layout)
    const interval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(interval);
      }
    }, 100);

    // Also listen for script load events
    const handleScriptLoad = () => {
      if (checkGoogleMaps()) {
        clearInterval(interval);
      }
    };

    window.addEventListener('load', handleScriptLoad);

    return () => {
      clearInterval(interval);
      window.removeEventListener('load', handleScriptLoad);
    };
  }, []);

  // Initialize autocomplete when script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !addressInputRef.current || !window.google?.maps?.places) {
      return;
    }

    // Initialize autocomplete
    const autocomplete = new window.google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: ['ca', 'us'] }, // Restrict to Canada and US
        fields: ['address_components', 'formatted_address', 'geometry']
      }
    );

    autocompleteRef.current = autocomplete;

    // Handle place selection
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      
      if (!place.address_components || !place.geometry) {
        return;
      }

      // Parse address components
      let streetNumber = '';
      let route = '';
      let city = '';
      let province = '';
      let postalCode = '';
      let addressLine2 = '';

      place.address_components.forEach((component: any) => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        } else if (types.includes('route')) {
          route = component.long_name;
        } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          province = component.short_name; // Use short name for province (e.g., "ON")
        } else if (types.includes('postal_code')) {
          postalCode = component.long_name.toUpperCase();
        } else if (types.includes('subpremise')) {
          addressLine2 = component.long_name;
        }
      });

      // Build address line 1
      const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim();

      // Get coordinates
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Track which fields were auto-filled
      const filledFields = new Set<string>();
      if (addressLine1) filledFields.add('address_line1');
      if (city) filledFields.add('city');
      if (province) filledFields.add('province');
      if (postalCode) filledFields.add('postal_code');
      if (addressLine2) filledFields.add('address_line2');
      setAutoFilledFields(filledFields);

      // Update the form using refs to avoid stale closures
      onChangeRef.current({
        ...valueRef.current,
        address_line1: addressLine1 || place.formatted_address.split(',')[0],
        address_line2: addressLine2 || valueRef.current.address_line2,
        city: city || valueRef.current.city,
        province: province || valueRef.current.province,
        postal_code: postalCode || valueRef.current.postal_code,
        latitude: lat,
        longitude: lng,
      });
    });

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isScriptLoaded]); // Only re-initialize when script loads

  const handleChange = (field: keyof AddressData, newValue: string | number | undefined) => {
    onChange({
      ...value,
      [field]: newValue,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          Street Address <span className="text-red-400">*</span>
        </label>
        <input
          ref={addressInputRef}
          type="text"
          required
          className="input"
          placeholder="123 Main Street"
          value={value.address_line1 || ''}
          onChange={(e) => handleChange('address_line1', e.target.value)}
          autoComplete="off"
        />
        {errors?.address_line1 && (
          <p className="text-red-400 text-sm mt-1">{errors.address_line1}</p>
        )}
        {isScriptLoaded && (
          <p className="text-slate-500 text-xs mt-1">Start typing your address for autocomplete suggestions</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Address Line 2 <span className="text-slate-500">(optional)</span>
        </label>
        <input
          type="text"
          className="input"
          placeholder="Apt, Suite, Unit, etc."
          value={value.address_line2 || ''}
          onChange={(e) => handleChange('address_line2', e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            City <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            className="input"
            placeholder="Toronto"
            value={value.city || ''}
            onChange={(e) => {
              handleChange('city', e.target.value);
              setAutoFilledFields(prev => {
                const next = new Set(prev);
                next.delete('city');
                return next;
              });
            }}
          />
          {autoFilledFields.has('city') && (
            <p className="text-cyan-400 text-xs mt-1">✓ Auto-filled from address</p>
          )}
          {errors?.city && (
            <p className="text-red-400 text-sm mt-1">{errors.city}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Province <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            className="input"
            placeholder="ON"
            value={value.province || ''}
            onChange={(e) => {
              handleChange('province', e.target.value);
              setAutoFilledFields(prev => {
                const next = new Set(prev);
                next.delete('province');
                return next;
              });
            }}
          />
          {autoFilledFields.has('province') && (
            <p className="text-cyan-400 text-xs mt-1">✓ Auto-filled from address</p>
          )}
          {errors?.province && (
            <p className="text-red-400 text-sm mt-1">{errors.province}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Postal Code <span className="text-red-400">*</span>
        </label>
          <input
            type="text"
            required
            className="input"
            placeholder="M5H 2N2"
            value={value.postal_code || ''}
            onChange={(e) => {
              handleChange('postal_code', e.target.value.toUpperCase());
              setAutoFilledFields(prev => {
                const next = new Set(prev);
                next.delete('postal_code');
                return next;
              });
            }}
          />
          {autoFilledFields.has('postal_code') && (
            <p className="text-cyan-400 text-xs mt-1">✓ Auto-filled from address</p>
          )}
        {errors?.postal_code && (
          <p className="text-red-400 text-sm mt-1">{errors.postal_code}</p>
        )}
      </div>

      <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
        <p className="text-sm text-cyan-300">
          <strong>Important:</strong> Please select your address from the autocomplete suggestions (start typing your address). This ensures we can accurately calculate distances and match you with nearby bookings. You can update this later in your settings.
        </p>
      </div>
    </div>
  );
}
