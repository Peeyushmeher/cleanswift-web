'use client';

import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);

const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const CreditCardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2"/>
    <line x1="2" x2="22" y1="10" y2="10"/>
  </svg>
);

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* How It Works Section */}
      <section className="py-24 relative pt-32">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-cyan-400 font-medium mb-4">Simple Process</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              How CleanSwift Works
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Get your car looking showroom-ready in three easy steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: <SparklesIcon />,
                title: 'Choose Your Service',
                description: 'Pick from interior, exterior, full detail, or premium packages right in the app.'
              },
              {
                step: '02',
                icon: <MapPinIcon />,
                title: 'Pick Time & Location',
                description: 'Tell us where your car is and when you\'re free. Your detailer comes to you.'
              },
              {
                step: '03',
                icon: <CreditCardIcon />,
                title: 'Pay & Relax',
                description: 'Pay securely through the app. Track your booking and get notified when it\'s done.'
              }
            ].map((item, i) => (
              <div key={i} className="relative group">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent z-0" />
                )}
                
                <div className="card p-8 relative z-10">
                  <div className="text-6xl font-display font-bold text-slate-800 absolute top-4 right-4">
                    {item.step}
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <h3 className="font-display text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-slate-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-500 text-sm mt-12">
            All payments are handled securely through Stripe
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
