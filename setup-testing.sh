#!/bin/bash

# Detailer Dashboard Testing Setup Script

echo "🚀 Setting up Detailer Dashboard for testing..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from web-dashboard directory"
    exit 1
fi

echo ""
echo "📦 Step 1: Installing dependencies..."
npm install

echo ""
echo "🔍 Step 2: Checking environment variables..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "   Please create .env.local with:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key"
else
    echo "✅ .env.local found"
fi

echo ""
echo "🗄️  Step 3: Database Migration Instructions"
echo "   Run the migration file in Supabase Dashboard:"
echo "   supabase/migrations/20250123000000_solo_mode_enhancements.sql"
echo ""
echo "   Or use Supabase CLI:"
echo "   supabase db push"

echo ""
echo "📦 Step 4: Storage Bucket Setup"
echo "   Create a storage bucket named 'job-photos' in Supabase Dashboard"
echo "   Or run the SQL provided in TESTING_GUIDE.md"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the dev server, run:"
echo "   npm run dev"
echo ""
echo "Then navigate to:"
echo "   http://localhost:3000/auth/login"
echo ""
echo "For detailed testing instructions, see:"
echo "   TESTING_GUIDE.md"

