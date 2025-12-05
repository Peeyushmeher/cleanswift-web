# Detailer Availability System - Implementation Guide

## Overview
This document explains the availability scheduling system that has been implemented. It allows detailers to set their weekly availability with optional lunch breaks and explicit days off, ensuring customers only see detailers who are actually available.

---

## Database Schema Changes

### 1. Enhanced `detailer_availability` Table
**New Columns Added:**
- `lunch_start_time` (time, nullable) - Start time of lunch break
- `lunch_end_time` (time, nullable) - End time of lunch break

**Constraint:**
- Both lunch times must be provided together, or both must be NULL
- `lunch_end_time` must be > `lunch_start_time`
- Lunch break must be within the main availability window (`start_time` to `end_time`)

**Example:**
```sql
-- A detailer available 9 AM - 5 PM with lunch 12 PM - 1 PM
{
  day_of_week: 1,  -- Monday
  start_time: '09:00:00',
  end_time: '17:00:00',
  lunch_start_time: '12:00:00',
  lunch_end_time: '13:00:00'
}
```

### 2. New `detailer_days_off` Table
**Purpose:** Store specific dates when a detailer is unavailable (holidays, vacations, etc.)

**Schema:**
```sql
CREATE TABLE detailer_days_off (
  id uuid PRIMARY KEY,
  detailer_id uuid REFERENCES detailers(id),
  date date NOT NULL,           -- The specific date (e.g., '2025-12-25')
  reason text,                   -- Optional reason (e.g., "Christmas", "Vacation")
  is_active boolean DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(detailer_id, date)
);
```

**Example:**
```sql
-- Detailer taking Christmas off
{
  detailer_id: '...',
  date: '2025-12-25',
  reason: 'Christmas Holiday',
  is_active: true
}
```

---

## RPC Functions (Supabase Functions)

### 1. `set_detailer_availability`
**Purpose:** Set or update a detailer's availability for a specific day of the week

**Parameters:**
```typescript
{
  p_day_of_week: number,        // 0=Sunday, 1=Monday, ..., 6=Saturday
  p_start_time: string,          // "09:00:00" format
  p_end_time: string,            // "17:00:00" format
  p_is_active: boolean,          // Default: true
  p_lunch_start_time?: string,   // Optional: "12:00:00" format
  p_lunch_end_time?: string      // Optional: "13:00:00" format
}
```

**Returns:** The created/updated `detailer_availability` record

**Usage Example:**
```typescript
const { data, error } = await supabase.rpc('set_detailer_availability', {
  p_day_of_week: 1,              // Monday
  p_start_time: '09:00:00',
  p_end_time: '17:00:00',
  p_is_active: true,
  p_lunch_start_time: '12:00:00',
  p_lunch_end_time: '13:00:00'
});
```

### 2. `get_detailer_availability`
**Purpose:** Get all availability slots for a detailer (including lunch breaks)

**Parameters:**
```typescript
{
  p_detailer_id?: string  // Optional, defaults to current user's detailer
}
```

**Returns:** JSON array of availability slots
```typescript
[
  {
    id: string,
    day_of_week: number,
    start_time: string,
    end_time: string,
    lunch_start_time: string | null,
    lunch_end_time: string | null,
    is_active: boolean,
    created_at: string,
    updated_at: string
  },
  ...
]
```

**Usage Example:**
```typescript
const { data, error } = await supabase.rpc('get_detailer_availability');
// Returns array of availability slots
```

### 3. `add_detailer_day_off`
**Purpose:** Add a specific date as a day off

**Parameters:**
```typescript
{
  p_date: string,        // "YYYY-MM-DD" format (e.g., "2025-12-25")
  p_reason?: string      // Optional reason
}
```

**Returns:** The created `detailer_days_off` record

**Usage Example:**
```typescript
const { data, error } = await supabase.rpc('add_detailer_day_off', {
  p_date: '2025-12-25',
  p_reason: 'Christmas Holiday'
});
```

### 4. `remove_detailer_day_off`
**Purpose:** Remove (deactivate) a day off

**Parameters:**
```typescript
{
  p_date: string  // "YYYY-MM-DD" format
}
```

**Returns:** The updated `detailer_days_off` record

**Usage Example:**
```typescript
const { data, error } = await supabase.rpc('remove_detailer_day_off', {
  p_date: '2025-12-25'
});
```

### 5. `get_detailer_days_off`
**Purpose:** Get all days off for a detailer within a date range

**Parameters:**
```typescript
{
  p_detailer_id?: string,  // Optional, defaults to current user
  p_start_date?: string,   // Optional, defaults to today
  p_end_date?: string      // Optional, defaults to 1 year from start
}
```

**Returns:** JSON array of day off records
```typescript
[
  {
    id: string,
    date: string,           // "YYYY-MM-DD"
    reason: string | null,
    is_active: boolean,
    created_at: string,
    updated_at: string
  },
  ...
]
```

**Usage Example:**
```typescript
const { data, error } = await supabase.rpc('get_detailer_days_off', {
  p_start_date: '2025-12-01',
  p_end_date: '2025-12-31'
});
```

### 6. `find_available_detailer` (Updated)
**Purpose:** Find an available detailer for a booking (now excludes lunch breaks and days off)

**Parameters:**
```typescript
{
  p_booking_date: string,              // "YYYY-MM-DD"
  p_booking_time_start: string,         // "HH:mm:ss"
  p_booking_time_end?: string,          // Optional
  p_service_duration_minutes?: number,  // Optional if end_time provided
  p_booking_lat?: number,               // Optional location
  p_booking_lng?: number,              // Optional location
  p_exclude_org_detailers?: boolean    // Default: false
}
```

**Returns:** `detailer_id` (uuid) or NULL if no one available

**What Changed:**
- Now excludes detailers if booking time overlaps with their lunch break
- Now excludes detailers if booking date is in their `detailer_days_off` table
- All other logic remains the same

---

## Frontend Implementation (Web App)

### Data Models

```typescript
// Availability Slot
interface AvailabilitySlot {
  day_of_week: number;        // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string;         // "HH:mm:ss" format
  end_time: string;           // "HH:mm:ss" format
  lunch_start_time?: string | null;  // Optional
  lunch_end_time?: string | null;    // Optional
}

// Day Off
interface DayOff {
  date: string;               // "YYYY-MM-DD" format
  reason?: string | null;
}
```

### UI Components

#### 1. Availability Selector Component
**File:** `app/components/onboard/AvailabilitySelector.tsx`

**Features:**
- Toggle days of the week on/off
- Set start/end times for each day
- Optional lunch break checkbox with time inputs
- Days off section with date picker
- Validates lunch break is within availability window

**Layout:**
- Each day is a card with checkbox
- When active, shows time inputs (start/end)
- Lunch break section appears on its own line below main times (prevents overflow)
- Days off section at bottom with date picker

#### 2. Availability Management Page
**File:** `app/detailer/availability/page.tsx`

**Features:**
- View/edit all availability slots
- Add/remove lunch breaks per day
- Manage days off (add/remove with date picker)
- Real-time updates to database

### Onboarding Flow
**File:** `app/onboard/detailer/page.tsx`

**Changes:**
- Step 4: Availability Hours - includes lunch breaks and days off
- Step 5: Review - shows selected availability and days off
- Saves both availability and days off when creating profile

---

## Mobile App Implementation Guide

### 1. Availability Setup Screen

**UI Components Needed:**
- Day selector (checkboxes for Sunday-Saturday)
- Time pickers for start/end times
- Optional lunch break toggle with time pickers
- Date picker for days off
- List view of selected days off

**Data Flow:**
```typescript
// 1. User selects days and sets times
const availability: AvailabilitySlot[] = [
  {
    day_of_week: 1,
    start_time: '09:00:00',
    end_time: '17:00:00',
    lunch_start_time: '12:00:00',
    lunch_end_time: '13:00:00'
  }
];

// 2. Save each slot
for (const slot of availability) {
  await supabase.rpc('set_detailer_availability', {
    p_day_of_week: slot.day_of_week,
    p_start_time: slot.start_time,
    p_end_time: slot.end_time,
    p_is_active: true,
    p_lunch_start_time: slot.lunch_start_time || null,
    p_lunch_end_time: slot.lunch_end_time || null
  });
}

// 3. Save days off
for (const dayOff of daysOff) {
  await supabase.rpc('add_detailer_day_off', {
    p_date: dayOff.date,
    p_reason: dayOff.reason || null
  });
}
```

### 2. Availability Management Screen

**Features:**
- Display current availability for all days
- Edit times for each day
- Toggle lunch breaks on/off
- Add/remove days off
- Save changes immediately

**Fetch Current Availability:**
```typescript
// Get availability
const { data: availability } = await supabase.rpc('get_detailer_availability');

// Get days off
const { data: daysOff } = await supabase.rpc('get_detailer_days_off');
```

### 3. Booking Flow (Customer Side)

**No Changes Needed!** The `find_available_detailer` function automatically:
- Excludes detailers with lunch breaks during booking time
- Excludes detailers with days off on booking date
- Only returns detailers who are actually available

**Usage (unchanged):**
```typescript
const { data: detailerId } = await supabase.rpc('find_available_detailer', {
  p_booking_date: '2025-12-15',
  p_booking_time_start: '14:00:00',
  p_service_duration_minutes: 120
});
```

---

## Key Implementation Points

### Time Format
- **Database:** Always use `"HH:mm:ss"` format (e.g., `"09:00:00"`, `"17:00:00"`)
- **Display:** Can format as `"HH:mm"` for UI (e.g., `"09:00"`, `"5:00 PM"`)
- **Conversion:** `"09:00"` → `"09:00:00"` (add `:00` if missing seconds)

### Day of Week Mapping
```typescript
0 = Sunday
1 = Monday
2 = Tuesday
3 = Wednesday
4 = Thursday
5 = Friday
6 = Saturday
```

### Validation Rules
1. **Lunch Break:**
   - Both start and end must be provided together, or both null
   - End time must be > start time
   - Must be within main availability window

2. **Days Off:**
   - Date must be in future (enforced by function)
   - Unique per detailer per date

3. **Availability:**
   - End time must be > start time
   - Day of week must be 0-6

### Error Handling
All RPC functions return:
```typescript
{
  data: T | null,
  error: {
    message: string,
    code: string
  } | null
}
```

**Common Errors:**
- `"Not authenticated"` - User not logged in
- `"Only detailers can set availability"` - Wrong user role
- `"Lunch break must be within availability window"` - Validation error
- `"Cannot add days off for past dates"` - Date validation

---

## Testing Checklist

### Availability Setup
- [ ] Can set availability for each day of week
- [ ] Can add lunch break to a day
- [ ] Can remove lunch break from a day
- [ ] Validation prevents invalid lunch break times
- [ ] Can add days off
- [ ] Can remove days off
- [ ] Changes save correctly to database

### Booking Flow
- [ ] Detailers with lunch breaks are excluded during lunch time
- [ ] Detailers with days off are excluded on those dates
- [ ] Available detailers are still returned correctly
- [ ] Location-based filtering still works

### Edge Cases
- [ ] Detailer with lunch break can still be booked outside lunch hours
- [ ] Detailer with day off can still be booked on other dates
- [ ] Multiple days off are handled correctly
- [ ] Timezone handling (if applicable)

---

## Summary

**What Was Added:**
1. ✅ Lunch break support in `detailer_availability` table
2. ✅ New `detailer_days_off` table for explicit dates
3. ✅ Updated `find_available_detailer` to exclude lunch breaks and days off
4. ✅ New RPC functions for managing availability and days off
5. ✅ Frontend components for setting availability with lunch breaks
6. ✅ Frontend components for managing days off

**What You Need to Implement on Mobile:**
1. UI for setting weekly availability (with lunch break option)
2. UI for managing days off (date picker + list)
3. API calls to the same RPC functions
4. Same data models and validation logic

**What Works Automatically:**
- Booking flow already respects lunch breaks and days off
- No changes needed to customer booking experience
- Backend handles all availability logic

