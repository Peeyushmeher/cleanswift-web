/**
 * Script to get or create a Stripe price for the subscription product
 * Run with: npx tsx scripts/get-or-create-price.ts
 */

import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const productId = 'prod_TfgygGxpzaXmSE'; // Your product ID
const monthlyPrice = 99.99; // Your monthly subscription price
const currency = 'cad'; // Currency

if (!stripeKey) {
  console.error('❌ STRIPE_SECRET_KEY not set in environment');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2025-12-15.clover',
});

async function getOrCreatePrice() {
  try {
    console.log('🔍 Checking for existing prices for product:', productId);
    
    // List all prices for this product
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });

    console.log(`\n📋 Found ${prices.data.length} price(s) for this product:`);
    
    if (prices.data.length > 0) {
      prices.data.forEach((price, index) => {
        console.log(`\n${index + 1}. Price ID: ${price.id}`);
        console.log(`   Amount: ${(price.unit_amount || 0) / 100} ${price.currency.toUpperCase()}`);
        console.log(`   Interval: ${price.recurring?.interval || 'one-time'}`);
        console.log(`   Active: ${price.active}`);
      });
      
      // Check if there's a monthly recurring price matching our amount
      const matchingPrice = prices.data.find(
        (p) =>
          p.recurring?.interval === 'month' &&
          p.unit_amount === Math.round(monthlyPrice * 100) &&
          p.currency === currency
      );

      if (matchingPrice) {
        console.log(`\n✅ Found matching monthly price: ${matchingPrice.id}`);
        console.log(`\n📝 Update your database with this price ID:`);
        console.log(`\n   UPDATE platform_settings`);
        console.log(`   SET value = '${matchingPrice.id}'::jsonb`);
        console.log(`   WHERE key = 'subscription_price_id';`);
        return matchingPrice.id;
      } else {
        console.log(`\n⚠️  No matching monthly price found. Creating new one...`);
      }
    } else {
      console.log('⚠️  No prices found for this product. Creating new one...');
    }

    // Create a new price
    console.log(`\n💰 Creating new monthly subscription price...`);
    console.log(`   Product: ${productId}`);
    console.log(`   Amount: $${monthlyPrice} ${currency.toUpperCase()}`);
    console.log(`   Interval: monthly`);

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(monthlyPrice * 100), // Convert to cents
      currency: currency,
      recurring: {
        interval: 'month',
      },
      metadata: {
        type: 'detailer_monthly_subscription',
      },
    });

    console.log(`\n✅ Created new price: ${price.id}`);
    console.log(`\n📝 Update your database with this price ID:`);
    console.log(`\n   UPDATE platform_settings`);
    console.log(`   SET value = '${price.id}'::jsonb`);
    console.log(`   WHERE key = 'subscription_price_id';`);
    
    console.log(`\n📝 Or update Supabase Edge Functions environment variable:`);
    console.log(`   STRIPE_SUBSCRIPTION_PRICE_ID=${price.id}`);

    return price.id;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'resource_missing') {
      console.error('❌ Product not found. Make sure the product ID is correct.');
    }
    process.exit(1);
  }
}

getOrCreatePrice()
  .then((priceId) => {
    console.log(`\n✅ Done! Price ID: ${priceId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

