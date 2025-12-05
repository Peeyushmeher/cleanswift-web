'use client';

import { useState, useEffect } from 'react';

export interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  lunch_start_time?: string;
  lunch_end_time?: string;
}

export interface DayOff {
  date: string; // YYYY-MM-DD format
  reason?: string;
}

interface AvailabilitySelectorProps {
  value: AvailabilitySlot[];
  onChange: (availability: AvailabilitySlot[]) => void;
  daysOff?: DayOff[];
  onDaysOffChange?: (daysOff: DayOff[]) => void;
  errors?: Partial<Record<string, string>>;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilitySelector({ 
  value, 
  onChange, 
  daysOff = [], 
  onDaysOffChange,
  errors 
}: AvailabilitySelectorProps) {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(value || []);
  const [localDaysOff, setLocalDaysOff] = useState<DayOff[]>(daysOff || []);

  useEffect(() => {
    setAvailability(value || []);
  }, [value]);

  useEffect(() => {
    setLocalDaysOff(daysOff || []);
  }, [daysOff]);

  const getSlotForDay = (dayOfWeek: number): AvailabilitySlot | undefined => {
    return availability.find((slot) => slot.day_of_week === dayOfWeek);
  };

  const handleToggleDay = (dayOfWeek: number) => {
    const existingSlot = getSlotForDay(dayOfWeek);
    let newAvailability: AvailabilitySlot[];

    if (existingSlot) {
      // Remove the day
      newAvailability = availability.filter((slot) => slot.day_of_week !== dayOfWeek);
    } else {
      // Add the day with default hours (9 AM - 5 PM)
      newAvailability = [
        ...availability,
        {
          day_of_week: dayOfWeek,
          start_time: '09:00:00',
          end_time: '17:00:00',
        },
      ];
    }

    setAvailability(newAvailability);
    onChange(newAvailability);
  };

  const handleTimeChange = (dayOfWeek: number, field: 'start_time' | 'end_time' | 'lunch_start_time' | 'lunch_end_time', timeValue: string) => {
    const existingSlot = getSlotForDay(dayOfWeek);
    const formattedTime = timeValue.includes(':') && timeValue.split(':').length === 2 ? `${timeValue}:00` : timeValue;

    let newAvailability: AvailabilitySlot[];

    if (existingSlot) {
      // Update existing slot
      newAvailability = availability.map((slot) =>
        slot.day_of_week === dayOfWeek
          ? {
              ...slot,
              [field]: formattedTime,
            }
          : slot
      );
    } else {
      // Create new slot with default for the other field
      newAvailability = [
        ...availability,
        {
          day_of_week: dayOfWeek,
          start_time: field === 'start_time' ? formattedTime : '09:00:00',
          end_time: field === 'end_time' ? formattedTime : '17:00:00',
        },
      ];
    }

    setAvailability(newAvailability);
    onChange(newAvailability);
  };

  const handleLunchBreakToggle = (dayOfWeek: number) => {
    const existingSlot = getSlotForDay(dayOfWeek);
    if (!existingSlot) return;

    const hasLunchBreak = existingSlot.lunch_start_time && existingSlot.lunch_end_time;
    
    const newAvailability = availability.map((slot) =>
      slot.day_of_week === dayOfWeek
        ? {
            ...slot,
            lunch_start_time: hasLunchBreak ? undefined : '12:00:00',
            lunch_end_time: hasLunchBreak ? undefined : '13:00:00',
          }
        : slot
    );

    setAvailability(newAvailability);
    onChange(newAvailability);
  };

  const handleAddDayOff = () => {
    const today = new Date().toISOString().split('T')[0];
    const newDayOff: DayOff = { date: today };
    const updated = [...localDaysOff, newDayOff];
    setLocalDaysOff(updated);
    onDaysOffChange?.(updated);
  };

  const handleRemoveDayOff = (date: string) => {
    const updated = localDaysOff.filter(d => d.date !== date);
    setLocalDaysOff(updated);
    onDaysOffChange?.(updated);
  };

  const handleDayOffDateChange = (oldDate: string, newDate: string) => {
    const updated = localDaysOff.map(d => d.date === oldDate ? { ...d, date: newDate } : d);
    setLocalDaysOff(updated);
    onDaysOffChange?.(updated);
  };

  const handleDayOffReasonChange = (date: string, reason: string) => {
    const updated = localDaysOff.map(d => d.date === date ? { ...d, reason } : d);
    setLocalDaysOff(updated);
    onDaysOffChange?.(updated);
  };

  const formatTime = (time: string): string => {
    return time.substring(0, 5); // HH:mm
  };

  return (
    <div className="space-y-4">
      {DAY_NAMES.map((dayName, index) => {
        const slot = getSlotForDay(index);
        const isActive = !!slot;

        return (
          <div
            key={index}
            className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => handleToggleDay(index)}
                    className="w-5 h-5 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-white font-medium w-24">{dayName}</span>
                </label>

                {isActive && slot && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="time"
                      value={formatTime(slot.start_time)}
                      onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={formatTime(slot.end_time)}
                      onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}
              </div>
              
              {/* Lunch Break Section - Always on its own line when active */}
              {isActive && slot && (
                <div className="flex items-center gap-2 pl-8">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(slot.lunch_start_time && slot.lunch_end_time)}
                      onChange={() => handleLunchBreakToggle(index)}
                      className="w-4 h-4 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-slate-400 text-xs">Lunch</span>
                  </label>
                  
                  {slot.lunch_start_time && slot.lunch_end_time && (
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={formatTime(slot.lunch_start_time)}
                        onChange={(e) => handleTimeChange(index, 'lunch_start_time', e.target.value)}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="text-slate-500 text-xs">-</span>
                      <input
                        type="time"
                        value={formatTime(slot.lunch_end_time)}
                        onChange={(e) => handleTimeChange(index, 'lunch_end_time', e.target.value)}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {errors?.availability && (
        <p className="text-red-400 text-sm mt-1">{errors.availability}</p>
      )}

      {/* Days Off Section */}
      {onDaysOffChange && (
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-medium mb-1">Days Off</h3>
              <p className="text-slate-400 text-xs">Mark specific dates as unavailable (holidays, vacations, etc.)</p>
            </div>
            <button
              type="button"
              onClick={handleAddDayOff}
              className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 text-sm font-medium transition-colors"
            >
              + Add Day Off
            </button>
          </div>

          {localDaysOff.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No days off added</p>
          ) : (
            <div className="space-y-2">
              {localDaysOff.map((dayOff, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg"
                >
                  <input
                    type="date"
                    value={dayOff.date}
                    onChange={(e) => handleDayOffDateChange(dayOff.date, e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={dayOff.reason || ''}
                    onChange={(e) => handleDayOffReasonChange(dayOff.date, e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveDayOff(dayOff.date)}
                    className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}