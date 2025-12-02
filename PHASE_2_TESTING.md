# Phase 2 Testing Guide

## ✅ Migrations Applied

All Phase 2 migrations have been successfully applied:
1. ✅ Organization schema (tables created)
2. ✅ RLS policies (security configured)
3. ✅ Organization functions (management functions ready)

## 🧪 Test Setup Complete

A test organization has been created:
- **Organization Name:** "Test Car Wash Organization"
- **Detailer:** `detailer@test.com` (assigned as owner)
- **Mode:** Organization Mode

## 📋 Testing Checklist

### 1. Test Mode Detection

**Expected:** Dashboard should show "Organization Mode" badge

1. Login as `detailer@test.com`
2. Navigate to `/detailer/dashboard`
3. Check sidebar:
   - ✅ Should show "Organization Dashboard" subtitle
   - ✅ Should show "Organization Mode" badge
   - ✅ Should show "Teams" and "Members" in navigation

### 2. Test Navigation

**Expected:** Organization-specific nav items visible

- [ ] Home - `/detailer/dashboard`
- [ ] Jobs - `/detailer/bookings`
- [ ] Schedule - `/detailer/schedule`
- [ ] **Teams** - `/detailer/teams` (NEW - org mode only)
- [ ] **Members** - `/detailer/members` (NEW - org mode only)
- [ ] Earnings - `/detailer/earnings`
- [ ] Reviews - `/detailer/reviews`
- [ ] Settings - `/detailer/settings`

### 3. Test Organization Functions

Run these in Supabase SQL Editor (as the detailer user):

```sql
-- Test: Get user's organization
SELECT * FROM get_user_organization();

-- Test: Get organization members
SELECT * FROM get_organization_members(
  (SELECT id FROM organizations WHERE name = 'Test Car Wash Organization' LIMIT 1)
);

-- Test: Get user's role
SELECT get_user_role_in_organization(
  auth.uid(),
  (SELECT id FROM organizations WHERE name = 'Test Car Wash Organization' LIMIT 1)
);
```

### 4. Test RLS Policies

**Expected:** Detailer can only see their own organization

```sql
-- Should only return the test organization
SELECT * FROM organizations;

-- Should only return members of the test organization
SELECT * FROM organization_members;
```

### 5. Test Mode Switching

**To test Solo Mode:**
1. Remove detailer from organization:
```sql
UPDATE detailers
SET organization_id = NULL
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'detailer@test.com');
```

2. Refresh dashboard - should show "Detailer Dashboard" (no org badge)

**To restore Organization Mode:**
```sql
UPDATE detailers
SET organization_id = (SELECT id FROM organizations WHERE name = 'Test Car Wash Organization' LIMIT 1)
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'detailer@test.com');
```

## 🔍 Verification Queries

### Check Current Setup
```sql
SELECT 
  p.email,
  p.full_name,
  o.name as organization_name,
  om.role as org_role,
  d.organization_id,
  CASE 
    WHEN d.organization_id IS NOT NULL THEN 'Organization Mode'
    ELSE 'Solo Mode'
  END as current_mode
FROM profiles p
JOIN detailers d ON d.profile_id = p.id
LEFT JOIN organization_members om ON om.profile_id = p.id AND om.is_active = true
LEFT JOIN organizations o ON o.id = om.organization_id
WHERE p.email = 'detailer@test.com';
```

### Check All Organizations
```sql
SELECT 
  o.id,
  o.name,
  COUNT(om.id) as member_count,
  o.is_active,
  o.created_at
FROM organizations o
LEFT JOIN organization_members om ON om.organization_id = o.id AND om.is_active = true
GROUP BY o.id, o.name, o.is_active, o.created_at;
```

## 🐛 Troubleshooting

### Issue: Still showing "Solo Mode"
**Fix:** Check if detailer has `organization_id` set:
```sql
SELECT d.id, d.organization_id, o.name
FROM detailers d
LEFT JOIN organizations o ON o.id = d.organization_id
WHERE d.profile_id = (SELECT id FROM profiles WHERE email = 'detailer@test.com');
```

### Issue: Navigation not showing Teams/Members
**Fix:** 
1. Check browser console for errors
2. Verify mode detection in layout.tsx
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Issue: RLS errors
**Fix:** Verify organization_members record exists and is active:
```sql
SELECT * FROM organization_members
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'detailer@test.com');
```

## ✅ Success Criteria

Phase 2 is working correctly if:
- ✅ Dashboard shows "Organization Mode" badge
- ✅ Sidebar shows Teams and Members links
- ✅ Mode detection function works
- ✅ RLS policies prevent unauthorized access
- ✅ Organization functions are callable

## 🚀 Next Steps

Once Phase 2 testing is complete, proceed to:
- **Phase 3:** Organization Features (Teams, Members, Org-wide earnings, etc.)

