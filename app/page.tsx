'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';

// Icons as components
const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
    <path d="M12 18h.01"/>
  </svg>
);

const CarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const AppleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const PlayStoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 9.99l-2.302 2.302-8.634-8.634z"/>
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

// Phone mockup component
const PhoneMockup = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative ${className}`}>
    <div className="relative mx-auto w-[280px] h-[580px] bg-[#1a1a1a] rounded-[3rem] p-2 shadow-2xl shadow-cyan-500/20">
      {/* Phone frame */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1a1a1a] rounded-b-2xl z-10" />
      {/* Screen */}
      <div className="w-full h-full bg-[#0f172a] rounded-[2.5rem] overflow-hidden relative">
        {children}
      </div>
    </div>
  </div>
);

// FAQ Accordion Item
const FAQItem = ({ question, answer, isOpen, onClick }: { question: string; answer: string; isOpen: boolean; onClick: () => void }) => (
  <div className="border-b border-slate-800">
    <button
      onClick={onClick}
      className="w-full py-6 flex items-center justify-between text-left hover:text-cyan-400 transition-colors"
    >
      <span className="text-lg font-medium pr-4">{question}</span>
      <span className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
        <ChevronDownIcon />
      </span>
    </button>
    <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-6' : 'max-h-0'}`}>
      <p className="text-slate-400 leading-relaxed">{answer}</p>
    </div>
  </div>
);

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs = [
    {
      question: "Where is CleanSwift available right now?",
      answer: "We're currently launching in select cities, with more areas coming soon. Download the app to check availability in your area and join the waitlist if we're not there yet."
    },
    {
      question: "How do payments work?",
      answer: "Customers pay securely through the app using credit/debit cards or Apple Pay. Detailers receive payouts via Stripe Connect once the job is completed, typically within 2-3 business days."
    },
    {
      question: "Can anyone become a detailer on CleanSwift?",
      answer: "We review every application and look for experience, professionalism, and quality standards. We may ask for photos of past work and references. This ensures our customers get the best service possible."
    },
    {
      question: "Do detailers set their own prices?",
      answer: "Yes, detailers can set their pricing within our recommended ranges. This ensures customers get fair and consistent options while allowing detailers to price their services competitively."
    },
    {
      question: "What if I need to cancel or reschedule?",
      answer: "You can easily cancel or reschedule through the app. Cancellations made 24+ hours before your appointment are free. Last-minute changes may incur a small fee to compensate the detailer."
    },
    {
      question: "How long does a typical detail take?",
      answer: "Service times vary by package: Interior or Exterior details typically take 1-2 hours, Full Details 2-4 hours, and Premium packages with ceramic coating 4-6 hours. Your detailer will give you an accurate estimate."
    }
  ];

  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-8 animate-fade-in">
              <SparklesIcon />
              <span>Premium Mobile Detailing</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-fade-in-up">
              Mobile Car Detailing,{' '}
              <span className="text-accent-gradient">On Your Schedule</span>
            </h1>
            
            <p className="text-xl text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0 animate-fade-in-up delay-100">
              Book a professional detailer to your driveway in just a few taps. No phone calls, no waiting—everything happens inside the CleanSwift app.
            </p>

            {/* Feature bullets */}
            <div className="grid sm:grid-cols-2 gap-4 mb-10 animate-fade-in-up delay-200">
              {[
                { icon: <PhoneIcon />, text: 'Book from your phone in minutes' },
                { icon: <CarIcon />, text: 'Detailers come to your home or workplace' },
                { icon: <SearchIcon />, text: 'Transparent pricing before you confirm' },
                { icon: <StarIcon />, text: 'Verified detailers with ratings & reviews' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <span className="text-cyan-400">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up delay-300">
              <a href="https://apps.apple.com/your-app-link" className="btn-primary inline-flex items-center justify-center gap-2">
                <AppleIcon />
                Download for iOS
              </a>
            </div>

            <p className="mt-6 text-slate-500 text-sm animate-fade-in-up delay-400">
              Or <Link href="/onboard" className="text-cyan-400 hover:underline">apply as a detailer</Link> to start earning
            </p>
          </div>

          {/* Right content - Phone mockup */}
          <div className="relative flex justify-center lg:justify-end animate-float">
            <PhoneMockup>
              <div className="p-6 pt-12">
                {/* Status bar simulation */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm text-slate-400">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-4 h-2 bg-slate-400 rounded-sm" />
                    <div className="w-4 h-2 bg-slate-400 rounded-sm" />
                    <div className="w-6 h-3 bg-green-400 rounded-sm" />
                  </div>
                </div>
                
                {/* App header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-sm">
                    <SparklesIcon />
                  </div>
                  <div>
                    <p className="font-semibold">CleanSwift</p>
                    <p className="text-xs text-slate-400">Book your detail</p>
                  </div>
                </div>

                {/* Services preview */}
                <div className="space-y-3">
                  {['Interior Detail', 'Exterior Wash', 'Full Detail'].map((service, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{service}</p>
                          <p className="text-xs text-slate-400">2-3 hours</p>
                        </div>
                        <div className="text-cyan-400 font-semibold">${79 + i * 50}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Book button */}
                <button className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 font-semibold text-sm">
                  Book Now
                </button>
              </div>
            </PhoneMockup>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 p-4 rounded-2xl glass animate-pulse-glow">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 border-2 border-slate-900" />
                  ))}
                </div>
                <div className="text-sm">
                  <p className="font-semibold">200+ Detailers</p>
                  <p className="text-slate-400 text-xs">Ready to serve</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDownIcon />
        </div>
      </section>

      {/* Screenshots / Features Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-cyan-400 font-medium mb-4">App Preview</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              A Simple App for a Premium{' '}
              <span className="text-accent-gradient">Detailing Experience</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'Quick Booking',
                desc: 'Clean home tab for quick re-booking',
                screen: (
                  <div className="p-4 pt-8">
                    <div className="text-sm font-medium mb-4">Good morning! 👋</div>
                    <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
                      <div className="text-xs text-cyan-400 mb-1">Next Detail</div>
                      <div className="font-medium">Tomorrow, 10 AM</div>
                    </div>
                    <div className="text-xs text-slate-400 mb-2">Quick book</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Interior', 'Exterior', 'Full', 'Premium'].map(s => (
                        <div key={s} className="p-3 rounded-lg bg-slate-800/80 text-xs text-center">{s}</div>
                      ))}
                    </div>
                  </div>
                )
              },
              {
                title: 'Clear Pricing',
                desc: 'Transparent service breakdown & pricing',
                screen: (
                  <div className="p-4 pt-8">
                    <div className="text-sm font-medium mb-4">Full Detail Package</div>
                    <div className="space-y-2 mb-4">
                      {[
                        { item: 'Interior Clean', price: '$79' },
                        { item: 'Exterior Wash', price: '$49' },
                        { item: 'Wax & Polish', price: '$51' }
                      ].map(i => (
                        <div key={i.item} className="flex justify-between text-xs py-2 border-b border-slate-700/50">
                          <span className="text-slate-400">{i.item}</span>
                          <span>{i.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-semibold text-sm pt-2">
                      <span>Total</span>
                      <span className="text-cyan-400">$179</span>
                    </div>
                  </div>
                )
              },
              {
                title: 'Live Tracking',
                desc: 'Real-time booking status tracking',
                screen: (
                  <div className="p-4 pt-8">
                    <div className="text-sm font-medium mb-4">Order Status</div>
                    <div className="space-y-4">
                      {[
                        { status: 'Confirmed', done: true },
                        { status: 'Detailer en route', done: true },
                        { status: 'In progress', done: false, active: true },
                        { status: 'Complete', done: false }
                      ].map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            s.done ? 'bg-green-500' : s.active ? 'bg-cyan-500' : 'bg-slate-700'
                          }`}>
                            {s.done && '✓'}
                          </div>
                          <span className={`text-xs ${s.active ? 'text-cyan-400' : s.done ? '' : 'text-slate-500'}`}>{s.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              },
              {
                title: 'Pro Dashboard',
                desc: 'Detailer dashboard for managing jobs',
                screen: (
                  <div className="p-4 pt-8">
                    <div className="text-sm font-medium mb-4">Today&apos;s Jobs</div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-center">
                        <div className="text-lg font-bold text-cyan-400">$489</div>
                        <div className="text-[10px] text-slate-400">Today</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-800/80 text-center">
                        <div className="text-lg font-bold">3</div>
                        <div className="text-[10px] text-slate-400">Jobs</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {['10 AM - Full Detail', '2 PM - Interior'].map(j => (
                        <div key={j} className="p-2 rounded-lg bg-slate-800/80 text-xs">{j}</div>
                      ))}
                    </div>
                  </div>
                )
              }
            ].map((item, i) => (
              <div key={i} className="group">
                <div className="relative mx-auto w-[200px] h-[400px] bg-[#1a1a1a] rounded-[2rem] p-1.5 shadow-xl shadow-cyan-500/10 group-hover:shadow-cyan-500/20 transition-shadow mb-6">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#1a1a1a] rounded-b-xl z-10" />
                  <div className="w-full h-full bg-[#0f172a] rounded-[1.75rem] overflow-hidden">
                    {item.screen}
                  </div>
                </div>
                <h4 className="font-display font-bold text-lg text-center mb-2">{item.title}</h4>
                <p className="text-slate-400 text-sm text-center">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />
        
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-cyan-400 font-medium mb-4">Got Questions?</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="card p-6 lg:p-8">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Ready to Get Started with{' '}
              <span className="text-accent-gradient">CleanSwift</span>?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* For Car Owners */}
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-6">
                <CarIcon />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">For Car Owners</h3>
              <p className="text-slate-400 mb-8">
                Download the app and book your first detail in just a few taps.
              </p>
              <div className="flex flex-col gap-3">
                <a href="https://apps.apple.com/your-app-link" className="btn-primary inline-flex items-center justify-center gap-2">
                  <AppleIcon />
                  Download for iOS
                </a>
              </div>
            </div>

            {/* For Detailers */}
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-6">
                <SparklesIcon />
              </div>
              <h3 className="font-display text-2xl font-bold mb-3">For Detailers</h3>
              <p className="text-slate-400 mb-8">
                Start getting high-intent bookings and fast payouts today.
              </p>
              <Link href="/onboard" className="btn-primary w-full inline-flex items-center justify-center gap-2">
                Apply as a Detailer
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
              </Link>
              <p className="text-slate-500 text-sm mt-4">
                Free to join · No monthly fees
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
