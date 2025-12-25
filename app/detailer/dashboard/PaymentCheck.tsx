'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentCheck() {
  const router = useRouter();

  useEffect(() => {
    async function checkPayment() {
      try {
        const response = await fetch('/api/detailer/subscription/check-payment');
        
        if (response.ok) {
          const data = await response.json();
          if (data.needsPayment) {
            router.push('/detailer/subscription/payment');
          }
        }
      } catch (error) {
        console.error('Error checking subscription payment:', error);
        // On error, don't redirect - allow access to dashboard
      }
    }

    checkPayment();
  }, [router]);

  return null; // This component doesn't render anything
}

