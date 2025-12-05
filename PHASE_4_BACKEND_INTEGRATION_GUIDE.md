# Phase 4 Backend Integration Guide

## Overview

This guide explains the backend changes for Phase 4 (Service Radius / Travel Distance Logic) and how to integrate them into your app. The backend now filters detailers by their service radius, ensuring only detailers within their allowed travel distance are matched with bookings.

---

## Backend Changes Summary

### 1. Database Schema - Detailer Location Fields

Detailers now store location information:
- **`latitude`** (numeric) - Detailer's home base latitude
- **`longitude`** (numeric) - Detailer's home base longitude  
- **`service_radius_km`** (integer) - Maximum travel distance in km (default: 50)

These fields are set during onboarding and used for distance-based matching.

### 2. Distance Calculation

**Function:** `calculate_distance_km(lat1, lon1, lat2, lon2)`
- Uses the Haversine formula for accurate distance calculation
- Returns distance in kilometers
- Handles NULL values gracefully

### 3. Booking Matching Logic

The `find_available_detailer()` function now:
- ✅ Filters detailers by their service radius
- ✅ Only matches detailers where: `distance(booking_location, detailer_home) <= detailer.service_radius_km`
- ✅ Orders by distance (closest first), then rating

### 4. New Availability Check Function

**New Function:** `check_detailer_availability_in_radius()`

**Purpose:** Check if any detailers are available BEFORE creating a booking (to show "no detailer available" messages).

**Returns JSON:**
```json
{
  "available": true/false,
  "detailer_count": 2,
  "nearest_distance_km": 5.3,
  "message": "No detailers are available..." // only if available=false
}
```

**Function Signature:**
```sql
check_detailer_availability_in_radius(
  p_booking_date date,              -- Required: '2025-02-15'
  p_booking_time_start time,        -- Required: '10:00:00'
  p_booking_lat numeric,            -- Required: 43.6532
  p_booking_lng numeric,             -- Required: -79.3832
  p_booking_time_end time,           -- Optional: '12:00:00'
  p_service_duration_minutes integer, -- Optional: 120
  p_exclude_org_detailers boolean    -- Optional: false
)
```

### 5. New API Endpoint

**Endpoint:** `POST /api/bookings/check-availability`

**Request Body:**
```json
{
  "booking_date": "2025-02-15",
  "booking_time_start": "10:00:00",
  "booking_lat": 43.6532,
  "booking_lng": -79.3832,
  "booking_time_end": null,           // optional
  "service_duration_minutes": 120,    // optional (if end_time not provided)
  "exclude_org_detailers": false      // optional
}
```

**Response (Available):**
```json
{
  "data": {
    "available": true,
    "detailer_count": 3,
    "nearest_distance_km": 2.5
  }
}
```

**Response (Not Available):**
```json
{
  "data": {
    "available": false,
    "detailer_count": 0,
    "nearest_distance_km": null,
    "message": "No detailers are available in your area for this time slot. Please try a different time or location."
  }
}
```

---

## How to Use in Your App

### Step 1: Check Availability Before Booking

Before creating a booking, call the availability endpoint:

```typescript
// Example: Check availability before showing booking form
async function checkAvailability(bookingData) {
  const response = await fetch('/api/bookings/check-availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_date: bookingData.date,        // '2025-02-15'
      booking_time_start: bookingData.time,   // '10:00:00'
      booking_lat: bookingData.latitude,      // 43.6532
      booking_lng: bookingData.longitude,     // -79.3832
      service_duration_minutes: 120           // or calculate from service
    })
  });
  
  const { data } = await response.json();
  
  if (!data.available) {
    // Show message to user
    alert(data.message);
    // Optionally: Allow user to expand radius or try different time
    return false;
  }
  
  // Proceed with booking creation
  return true;
}
```

### Step 2: Show "No Detailer Available" Message

When `available: false`, show:
- ✅ The message from the API response
- ✅ Option to try a different time
- ✅ Option to try a different location
- 🔮 Future: Option to expand search radius

**Example UI:**
```typescript
if (!availabilityData.available) {
  return (
    <div className="alert alert-warning">
      <h3>No Detailers Available</h3>
      <p>{availabilityData.message}</p>
      <div className="actions">
        <button onClick={tryDifferentTime}>Try Different Time</button>
        <button onClick={tryDifferentLocation}>Try Different Location</button>
      </div>
    </div>
  );
}
```

### Step 3: Booking Creation

When creating a booking, ensure you include:
- **`latitude`** - Booking location latitude
- **`longitude`** - Booking location longitude

The backend will automatically:
- ✅ Filter detailers by their service radius
- ✅ Only assign detailers within their allowed distance
- ✅ Prefer closer detailers

**Example Booking Creation:**
```typescript
const booking = await createBooking({
  car_id: carId,
  scheduled_start: scheduledStart,
  location_address: address,
  city: city,
  province: province,
  postal_code: postalCode,
  service_ids: [serviceId],
  location_lat: latitude,      // ⚠️ REQUIRED for distance matching
  location_lng: longitude,     // ⚠️ REQUIRED for distance matching
  location_notes: notes
});
```

### Step 4: Detailer Onboarding

During detailer signup, collect:
- **Home base address** (with lat/lng from geocoding)
- **Max travel radius** (1-200 km)

The backend validates that:
- ✅ Address has lat/lng coordinates
- ✅ Service radius is between 1-200 km

---

## Complete Example Flow

```
User wants to book:
1. User enters booking location → Get lat/lng (geocoding)
2. User selects date/time
3. [NEW] Call /api/bookings/check-availability
4. If available → Show booking form
5. If not available → Show message, suggest alternatives
6. Create booking with lat/lng
7. Backend auto-assigns detailer within radius
```

**Code Example:**
```typescript
async function handleBookingFlow(bookingData) {
  // Step 1: Geocode address to get lat/lng
  const { lat, lng } = await geocodeAddress(bookingData.address);
  
  // Step 2: Check availability
  const availability = await checkAvailability({
    date: bookingData.date,
    time: bookingData.time,
    latitude: lat,
    longitude: lng,
    duration: bookingData.service.duration_minutes
  });
  
  // Step 3: Handle response
  if (!availability.available) {
    showNoDetailerMessage(availability.message);
    return;
  }
  
  // Step 4: Create booking with location
  const booking = await createBooking({
    ...bookingData,
    location_lat: lat,
    location_lng: lng
  });
  
  // Step 5: Backend automatically assigns detailer within radius
  return booking;
}
```

---

## What Changed vs. Before

### Before:
- ❌ Detailers matched by availability only
- ❌ No distance filtering
- ❌ No way to check availability before booking

### Now:
- ✅ Detailers matched by availability AND distance
- ✅ Only detailers within their service radius are considered
- ✅ Can check availability before booking
- ✅ Clear messages when no detailers available

---

## Important Points

1. **Location is Required:** Both bookings and detailers need lat/lng coordinates for distance matching to work.

2. **Service Radius is Enforced:** Detailers will only see bookings within their configured service radius.

3. **Distance is Calculated Automatically:** The backend handles all distance calculations using the Haversine formula.

4. **Availability Check is Optional:** You can check before booking, or let the backend handle it during auto-assignment.

---

## API Testing

### Test the Availability Endpoint

```bash
curl -X POST http://your-api/api/bookings/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "booking_date": "2025-02-15",
    "booking_time_start": "10:00:00",
    "booking_lat": 43.6532,
    "booking_lng": -79.3832,
    "service_duration_minutes": 120
  }'
```

### Expected Response (No Detailers):
```json
{
  "data": {
    "available": false,
    "detailer_count": 0,
    "nearest_distance_km": null,
    "message": "No detailers are available in your area for this time slot. Please try a different time or location."
  }
}
```

### Expected Response (Detailers Available):
```json
{
  "data": {
    "available": true,
    "detailer_count": 3,
    "nearest_distance_km": 2.5
  }
}
```

---

## Database Function Reference

### Direct Database Call (if needed)

```sql
-- Check availability directly from database
-- Note: Required parameters (date, time, lat, lng) must come before optional parameters
SELECT check_detailer_availability_in_radius(
  p_booking_date := '2025-02-15'::date,
  p_booking_time_start := '10:00:00'::time,
  p_booking_lat := 43.6532,
  p_booking_lng := -79.3832,
  p_service_duration_minutes := 120,
  p_exclude_org_detailers := false
);
```

---

## Error Handling

### Common Errors

**Missing Location:**
```json
{
  "error": "booking_lat and booking_lng are required"
}
```

**Missing Date/Time:**
```json
{
  "error": "booking_date and booking_time_start are required"
}
```

**Invalid Parameters:**
```json
{
  "data": {
    "available": false,
    "error": "Either booking_time_end or service_duration_minutes must be provided"
  }
}
```

---

## Migration Status

✅ **Migration Applied:** `add_check_detailer_availability_function`
- Function created and tested
- Permissions granted to `authenticated` and `anon` roles
- API endpoint configured

---

## Next Steps for Your App

1. **Add geocoding** to convert addresses to lat/lng
2. **Call availability check** before showing booking form
3. **Display "no detailer available"** message when needed
4. **Ensure booking creation** includes lat/lng coordinates
5. **Test the flow** with various locations and times

---

## Support

If you encounter issues:
- Check that booking locations include lat/lng
- Verify detailers have location data set during onboarding
- Ensure service_radius_km is set (defaults to 50 if not provided)
- Check API response for error messages

