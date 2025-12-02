# Quick Testing Checklist

## ✅ Pre-Testing Setup

1. **Run Database Migration**
   ```sql
   -- In Supabase SQL Editor, run:
   -- supabase/migrations/20250123000000_solo_mode_enhancements.sql
   ```

2. **Create Storage Bucket**
   - Supabase Dashboard → Storage → Create bucket `job-photos`
   - Set to Public OR configure RLS policies (see TESTING_GUIDE.md)

3. **Start Dev Server**
   ```bash
   cd web-dashboard
   npm run dev
   ```

## 🧪 Quick Test Flow

### 1. Login & Navigation
- [ ] Login at `/auth/login` with detailer account
- [ ] Verify redirect to `/detailer/dashboard`
- [ ] Check sidebar navigation (Home, Jobs, Schedule, Earnings, Reviews, Settings)
- [ ] Test responsive sidebar (resize browser)

### 2. Dashboard (/detailer/dashboard)
- [ ] Stats cards show correct numbers
- [ ] Earnings chart displays
- [ ] Today's jobs list shows bookings
- [ ] Rating summary displays correctly

### 3. Jobs Page (/detailer/bookings)
- [ ] Jobs table displays bookings
- [ ] Test search by booking ID
- [ ] Test date filter (Today, This Week)
- [ ] Test status filter
- [ ] Test sorting
- [ ] Click job row → navigates to detail

### 4. Job Detail (/detailer/bookings/[id])
- [ ] All booking info displays
- [ ] Job Timeline component renders
- [ ] Payment Breakdown shows calculations
- [ ] Map component loads (may need Google Maps API key)
- [ ] Can add internal note
- [ ] Can upload photo (if storage bucket configured)
- [ ] Can update status (Start Service / Mark Complete)
- [ ] Contact customer buttons work

### 5. Schedule (/detailer/schedule)
- [ ] Calendar displays bookings
- [ ] Can navigate months
- [ ] Status colors correct

### 6. Earnings (/detailer/earnings)
- [ ] Total earnings displays
- [ ] Earnings chart shows data
- [ ] Earnings table lists completed jobs

### 7. Reviews (/detailer/reviews)
- [ ] Reviews list displays
- [ ] Rating filter works
- [ ] Sort by date/rating works

### 8. Settings (/detailer/settings)
- [ ] Can update profile name/phone
- [ ] Can update service area
- [ ] Notification toggles work
- [ ] Save button works

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Migration fails | Tables might already exist - safe to re-run |
| Photo upload fails | Create `job-photos` storage bucket |
| RLS errors | Verify detailer has `profile_id` in detailers table |
| Components not rendering | Check browser console, verify imports |

## 📝 Notes

- **Photo Upload**: Requires storage bucket `job-photos` to be created
- **Map Component**: Uses Google Maps embed (no API key needed for embed, but may need for custom maps)
- **Real-time Updates**: Hook is created but needs integration into pages (future enhancement)
- **Stripe Connect**: Placeholder UI only - not functional yet

## ✅ Ready for Phase 2?

Once all core features work:
- [ ] Dashboard displays correctly
- [ ] Jobs module works with filters
- [ ] Job detail page shows all components
- [ ] Earnings and Reviews pages load
- [ ] Settings can be saved

You're ready to proceed to Phase 2: Organization Foundation!

