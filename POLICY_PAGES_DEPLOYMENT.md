# Policy Pages Deployment Guide

This guide explains how to deploy and customize the Privacy Policy, Terms of Service, and Refund Policy pages for CleanSwift.

## 📄 Pages Created

The following pages have been created and are ready for deployment:

- **Privacy Policy**: `/privacy-policy`
- **Terms of Service**: `/terms-of-service`
- **Refund Policy**: `/refund-policy`

All pages are accessible at:
- `https://[your-domain]/privacy-policy`
- `https://[your-domain]/terms-of-service`
- `https://[your-domain]/refund-policy`

## 🎨 Design Features

- **Dark theme** matching your app's design system
- **Fully responsive** (mobile, tablet, desktop)
- **Professional typography** using your existing fonts (DM Sans, Outfit)
- **Brand colors**: 
  - Background: `#030712`
  - Accent: `#22d3ee` / `#06b6d4`
  - Text: `#f8fafc` / `#cbd5e1`
- **SEO-friendly** with proper metadata
- **Fast loading** with optimized Next.js rendering

## ✏️ Customization Required

Before deploying, you need to update the following placeholders in each file:

### 1. Business Information

**Files to update:**
- `app/privacy-policy/page.tsx`
- `app/terms-of-service/page.tsx`

**Placeholders to replace:**
- `[YOUR BUSINESS ADDRESS]` - Replace with your actual business address
- `[JURISDICTION]` - Replace with your legal jurisdiction (e.g., "California, United States")

### 2. Last Updated Date

**Files to update:**
- `app/privacy-policy/page.tsx` (line ~12)
- `app/terms-of-service/page.tsx` (line ~12)
- `app/refund-policy/page.tsx` (line ~12)

**Current value:** `December 2024`

Update this whenever you make changes to the policies.

### 3. Arbitration Organization (Optional)

**File to update:**
- `app/terms-of-service/page.tsx` (line ~280)

**Placeholder:** `[ARBITRATION ORGANIZATION]`

Replace with your preferred arbitration organization (e.g., "American Arbitration Association" or remove if not applicable).

## 🚀 Deployment

### Option 1: Deploy to Vercel (Recommended)

Since you already have `vercel.json` configured, deployment is straightforward:

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "Add policy pages"
   git push
   ```

2. **Deploy via Vercel:**
   - If connected to Vercel, it will auto-deploy
   - Or run: `vercel --prod`

3. **Verify:**
   - Visit `https://[your-domain]/privacy-policy`
   - Visit `https://[your-domain]/terms-of-service`
   - Visit `https://[your-domain]/refund-policy`

### Option 2: Deploy to Netlify

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy:**
   - Connect your repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `.next`

### Option 3: Deploy to Other Hosting

1. **Build:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

## 🔗 App Store Integration

Your mobile app should link to these URLs:

- **Privacy Policy URL:** `https://cleanswift.app/privacy-policy`
- **Terms of Service URL:** `https://cleanswift.app/terms-of-service`
- **Refund Policy URL:** `https://cleanswift.app/refund-policy`

Make sure your domain is properly configured and HTTPS is enabled (required for App Store).

## 📱 Testing

Before submitting to App Store, verify:

1. ✅ All three pages load correctly
2. ✅ Pages are mobile-responsive
3. ✅ Links between pages work (Terms ↔ Privacy ↔ Refund)
4. ✅ All placeholders are replaced with actual information
5. ✅ Contact email links work (`support@cleanswift.app`)
6. ✅ External links work (Stripe, Supabase, Google, Apple privacy policies)
7. ✅ HTTPS is enabled
8. ✅ Pages are accessible without authentication

## 🔄 Updating Policies

To update policy content:

1. Edit the relevant file in `app/[policy-name]/page.tsx`
2. Update the "Last Updated" date
3. Commit and push changes
4. Vercel will auto-deploy (or manually deploy)

## 📋 Content Checklist

### Privacy Policy
- ✅ Data collection details
- ✅ Third-party services (Stripe, Supabase, Google Maps, Apple/Google Sign-In)
- ✅ Data retention (7 years for bookings)
- ✅ User rights (access, correction, deletion, portability, opt-out)
- ✅ Security measures
- ✅ International transfers
- ✅ Children's privacy (18+)
- ✅ Contact information

### Terms of Service
- ✅ Service description
- ✅ Account requirements (18+, accurate info, security)
- ✅ Booking terms
- ✅ Cancellation policy (free up to 4 hours, late cancellation fee, no-show full charge)
- ✅ Rescheduling (up to 2 hours before)
- ✅ Payment terms (Stripe, Apple Pay)
- ✅ Refund policy reference
- ✅ User conduct
- ✅ Service provider relationship
- ✅ Limitation of liability
- ✅ Dispute resolution
- ✅ Contact information

### Refund Policy
- ✅ Free cancellation (4 hours before)
- ✅ Late cancellation fees
- ✅ No-show policy
- ✅ Completed services (no refunds except material failure)
- ✅ Refund processing (5-10 business days)
- ✅ Service provider cancellations
- ✅ Weather/force majeure
- ✅ Contact information

## 🎯 Next Steps

1. **Customize placeholders** (business address, jurisdiction, dates)
2. **Review content** with legal counsel if needed
3. **Test all pages** on mobile and desktop
4. **Deploy to production**
5. **Update mobile app** with correct URLs
6. **Submit to App Store** with policy URLs

## 📞 Support

If you need to make changes to the policy pages:

- Edit the `.tsx` files in `app/[policy-name]/page.tsx`
- The pages use Tailwind CSS classes matching your existing design system
- All styling is inline using your existing color scheme and fonts

## 🔒 Security Notes

- All pages are public (no authentication required)
- HTTPS is required for App Store compliance
- External links open in new tabs with `rel="noopener noreferrer"` for security
- No user data is collected on these static pages

---

**Ready for App Store submission!** 🚀

