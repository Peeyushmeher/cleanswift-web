# Onboarding Data Tracking and Verification Plan

## Overview
This plan ensures all data collected during the detailer onboarding process is properly saved to the database and can be referenced/viewed later.

## Onboarding Steps and Data Collected

### Step 1: Basic Information
**Data Collected:**
- `email` (if new user)
- `password` (if new user)
- `full_name` → Saved to `profiles.full_name` and `detailers.full_name`
- `phone` → Saved to `profiles.phone`
- `years_experience` → Saved to `detailers.years_experience`

**Storage Location:**
- `profiles` table: email, full_name, phone
- `detailers` table: full_name, years_experience

### Step 2: Location & Service Area
**Data Collected:**
- `address.address_line1` → Saved to `user_addresses.address_line1`
- `address.address_line2` → Saved to `user_addresses.address_line2`
- `address.city` → Saved to `user_addresses.city`
- `address.province` → Saved to `user_addresses.province`
- `address.postal_code` → Saved to `user_addresses.postal_code`
- `address.latitude` → Saved to `user_addresses.latitude` and `detailers.latitude`
- `address.longitude` → Saved to `user_addresses.longitude` and `detailers.longitude`
- `service_radius_km` → Saved to `detailers.service_radius_km`

**Storage Location:**
- `user_addresses` table: Complete address with coordinates
- `detailers` table: latitude, longitude, service_radius_km

### Step 3: Pricing Model
**Data Collected:**
- `pricing_model` ('subscription' or 'percentage') → Saved to `detailers.pricing_model`

**Storage Location:**
- `detailers` table: pricing_model

### Step 4: Profile Details
**Data Collected:**
- `bio` → Saved to `detailers.bio`
- `specialties` (array) → Saved to `detailers.specialties`
- `avatar_url` (optional) → Saved to `detailers.avatar_url`

**Storage Location:**
- `detailers` table: bio, specialties, avatar_url

### Step 5: Availability Hours
**Data Collected:**
- `availability[]` (array of slots) → Saved to `detailer_availability` table
  - Each slot: day_of_week, start_time, end_time, lunch_start_time, lunch_end_time
- `daysOff[]` (array) → Saved to `detailer_days_off` table
  - Each day off: date, reason

**Storage Location:**
- `detailer_availability` table: Weekly availability slots
- `detailer_days_off` table: Specific days off

### Step 6: Review & Submit
**Action:**
- Sets `profiles.onboarding_completed = true`
- All previous data should already be saved

## Implementation Plan

### 1. Add Comprehensive Logging
**File**: `app/onboard/actions.ts`

- Add detailed console logs at each save step
- Log what data is being saved and where
- Log any errors that occur during save
- Create a summary log of all saved data at the end

### 2. Add Data Verification Function
**File**: `app/onboard/actions.ts`

- Create a function to verify all onboarding data was saved correctly
- Check each table to ensure data exists
- Return a report of what was saved and what's missing
- This can be called after onboarding completion

### 3. Enhance Admin Detailer Profile View
**File**: `app/admin/detailers/[id]/page.tsx`

- Add a comprehensive "Onboarding Data" section showing:
  - All basic information
  - Complete address with map preview
  - Pricing model selection
  - Bio and specialties
  - Availability schedule
  - Days off
  - Service radius
- Display this information in an organized, readable format

### 4. Add Onboarding Data View for Detailers
**File**: `app/detailer/settings/page.tsx` or new component

- Allow detailers to view their own onboarding data
- Show what information was submitted during onboarding
- Make it clear what can be edited vs. what was submitted

### 5. Add Database Audit Trail
**Consideration**: Add a table to track onboarding submissions
- `onboarding_submissions` table with:
  - user_id
  - submitted_at
  - form_data (JSONB snapshot of all data)
  - This provides a complete record of what was submitted

## Verification Checklist

After onboarding, verify:
- [ ] Profile created with email, full_name, phone
- [ ] Detailer record created with full_name, years_experience
- [ ] Address saved to user_addresses with coordinates
- [ ] Service radius saved to detailers table
- [ ] Pricing model saved to detailers table
- [ ] Bio saved to detailers table (if provided)
- [ ] Specialties saved to detailers table (if provided)
- [ ] Availability slots saved to detailer_availability (if provided)
- [ ] Days off saved to detailer_days_off (if provided)
- [ ] onboarding_completed flag set to true
- [ ] All data is accessible via admin panel

## Testing Steps

1. Delete test account from database
2. Go through onboarding process step by step
3. Take screenshots at each step
4. After submission, verify all data in database:
   - Check profiles table
   - Check detailers table
   - Check user_addresses table
   - Check detailer_availability table
   - Check detailer_days_off table
5. View data in admin panel to ensure it displays correctly
6. Document any missing data or issues

