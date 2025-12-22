#!/bin/bash

# Script to manually trigger weekly payout processing
# This allows you to test the weekly batch payout system immediately

# Replace with your actual service role key
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGpwc3RrZ2J5YWF6bWN5YnNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI5NzY2OCwiZXhwIjoyMDc4ODczNjY4fQ.q9_N7IQB84m9FdxHW6DNMOwiPDZ9M9miybN5qwPopNQ"

SUPABASE_URL="https://nxxjpstkgbyaazmcybsf.supabase.co"

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

