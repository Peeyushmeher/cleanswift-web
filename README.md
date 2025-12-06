# CleanSwift Web Dashboard

Web dashboard for detailers and admins to manage bookings, availability, and users.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Create a `.env.local` file in the root directory
   - Add the following required variables:
   
   ```env
   # Supabase Configuration (Required)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Google Maps API (Optional - for maps functionality)
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```
   
   - Get Supabase credentials from: https://supabase.com/dashboard/project/_/settings/api
   - The mobile app uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` - use the same values but with `NEXT_PUBLIC_` prefix
   
   **Note for Supabase Edge Functions:**
   - Additional environment variables must be configured in Supabase Dashboard → Edge Functions → Settings
   - Required: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
   - Recommended: `ALLOWED_ORIGINS` (comma-separated list for CORS, e.g., "https://app.example.com")

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Detailer Dashboard
- **Dashboard**: Overview of upcoming bookings and earnings
- **Availability**: Set weekly availability schedule
- **Bookings**: View and manage assigned bookings
- **Booking Details**: View full booking details and update status

### Admin Dashboard
- **Dashboard**: Statistics and recent bookings overview
- **Bookings**: View all bookings with filters, manual assignment
- **Users**: Manage user accounts and roles
- **Detailers**: Manage detailer accounts and activation status

## Authentication

- Login page at `/auth/login`
- Role-based routing via middleware
- Detailers access `/detailer/*` routes
- Admins access `/admin/*` routes

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Authentication & Database)
- Server Actions for form submissions
