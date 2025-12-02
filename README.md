# CleanSwift Web Dashboard

Web dashboard for detailers and admins to manage bookings, availability, and users.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Supabase credentials:
   - A `.env.local` template file has been created in the `web-dashboard` directory
   - Open `.env.local` and replace the placeholder values with your actual Supabase credentials
   - Get your credentials from: https://supabase.com/dashboard/project/_/settings/api
   - The mobile app uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` - use the same values but with `NEXT_PUBLIC_` prefix

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
