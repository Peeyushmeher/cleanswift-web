#!/bin/bash

# Script to manually trigger weekly payout processing
# This allows you to test the weekly batch payout system immediately

# Replace with your actual service role key
SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"

SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"

echo "🚀 Triggering weekly payout processing..."
echo ""

response=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/process-weekly-payouts" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

echo "✅ Check the Supabase dashboard to see:"
echo "   1. solo_weekly_payout_batches table for the batch record"
echo "   2. detailer_transfers table - transfers should be updated to 'processing'"
echo "   3. Stripe Dashboard - you should see a transfer created"

