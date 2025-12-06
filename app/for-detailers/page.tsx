'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4"/>
    <path d="M16 2v4"/>
    <rect width="18" height="18" x="3" y="4" rx="2"/>
    <path d="M3 10h18"/>
  </svg>
);

const DollarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="2" y2="22"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const ChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="m19 9-5 5-4-4-3 3"/>
  </svg>
);

const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/>
    <path d="M12 16h4"/>
    <path d="M8 11h.01"/>
    <path d="M8 16h.01"/>
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

export default function ForDetailersPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    serviceArea: '',
    detailerType: 'solo',
    experience: '',
    services: [] as string[],
    socialLink: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitSuccess(true);
  };

  const services = [
    'Interior Detailing',
    'Exterior Detailing',
    'Full Detail',
    'Ceramic Coating',
    'Paint Correction',
    'Engine Bay Cleaning',
    'Headlight Restoration',
    'Odor Removal'
  ];

  return (
    <main className="min-h-screen">
      <Navigation />
      
      {/* Sign In CTA Section */}
      <section className="py-16 relative pt-32">
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Already a CleanSwift Detailer?
          </h1>
          <p className="text-slate-400 text-lg mb-8">
            Sign in to access your dashboard and manage your bookings
          </p>
          <Link href="/auth/login?switch=true" className="btn-primary inline-flex items-center gap-2">
            Sign In to Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* For Detailers Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-500/5 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div>
              <p className="text-cyan-400 font-medium mb-4">For Detailers & Detailing Businesses</p>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                Grow Your Detailing Business With{' '}
                <span className="text-accent-gradient">CleanSwift</span>
              </h2>
              <p className="text-slate-400 text-lg mb-10">
                Get a steady stream of bookings without chasing customers, answering DMs, or dealing with payment headaches.
              </p>

              <div className="space-y-6">
                {[
                  { icon: <CalendarIcon />, title: 'Pre-booked Jobs', desc: 'We send customers directly to you.' },
                  { icon: <DollarIcon />, title: 'Fast, Secure Payouts', desc: 'Get paid through CleanSwift using Stripe Connect.' },
                  { icon: <ChartIcon />, title: 'Detailer Dashboard', desc: 'Track bookings, earnings, and performance in one place.' },
                  { icon: <ClipboardIcon />, title: 'Less Admin, More Detailing', desc: 'We handle scheduling and payments so you can focus on the work.' },
                  { icon: <UsersIcon />, title: 'Solo or Teams', desc: 'Works for solo detailers and organizations with multiple technicians.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/onboard" className="btn-primary inline-flex items-center gap-2 mt-10">
                Start Onboarding Process
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/>
                  <path d="m12 5 7 7-7 7"/>
                </svg>
              </Link>
            </div>

            {/* Right content - Dashboard preview */}
            <div className="relative">
              <div className="card p-6 lg:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-slate-400 text-sm">Welcome back,</p>
                    <h3 className="font-display text-2xl font-bold">Mike&apos;s Auto Detail</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { label: 'This Week', value: '$2,450' },
                    { label: 'Jobs Done', value: '18' },
                    { label: 'Rating', value: '4.9' }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-800/50">
                      <p className="text-slate-400 text-xs mb-1">{stat.label}</p>
                      <p className="font-display text-xl font-bold text-cyan-400">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Upcoming jobs */}
                <div>
                  <p className="font-medium mb-4">Upcoming Jobs</p>
                  <div className="space-y-3">
                    {[
                      { time: '10:00 AM', service: 'Full Detail', location: '123 Oak St' },
                      { time: '2:30 PM', service: 'Interior', location: '456 Pine Ave' }
                    ].map((job, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{job.service}</p>
                          <p className="text-slate-400 text-xs">{job.location}</p>
                        </div>
                        <div className="text-cyan-400 font-medium text-sm">{job.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating notification */}
              <div className="absolute -bottom-6 -left-6 p-4 rounded-2xl glass animate-pulse-glow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                    <CheckIcon />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Payment Received</p>
                    <p className="text-slate-400 text-xs">$189.00 from today&apos;s job</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Onboarding Form Section */}
      <section id="apply" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-cyan-400 font-medium mb-4">Join Our Network</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
              Become a CleanSwift Detailer
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Tell us a bit about you and your business. We&apos;ll review your info and help you get set up.
            </p>
          </div>

          {/* Process steps */}
          <div className="grid sm:grid-cols-4 gap-4 mb-12">
            {[
              { step: 1, title: 'Apply Online', desc: 'Fill out the form below' },
              { step: 2, title: 'Get Approved', desc: 'We review & connect you' },
              { step: 3, title: 'Set Up Profile', desc: 'Add services & pricing' },
              { step: 4, title: 'Start Earning', desc: 'Accept your first jobs' }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-slate-400 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          {submitSuccess ? (
            <div className="card p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mx-auto mb-6">
                <CheckIcon />
              </div>
              <h3 className="font-display text-2xl font-bold mb-4">Application Submitted!</h3>
              <p className="text-slate-400 mb-6">
                Thank you for applying to become a CleanSwift Detailer. We&apos;ll review your application and get back to you within 24-48 hours.
              </p>
              <button 
                onClick={() => setSubmitSuccess(false)}
                className="text-cyan-400 hover:underline"
              >
                Submit another application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card p-8 lg:p-12">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="John Smith"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Business Name <span className="text-slate-500">(optional)</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Smith's Auto Detailing"
                    value={formData.businessName}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    className="input"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className="input"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">City / Service Area *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="Los Angeles, CA"
                    value={formData.serviceArea}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceArea: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Years of Experience *</label>
                  <select
                    required
                    className="input"
                    value={formData.experience}
                    onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                  >
                    <option value="">Select experience</option>
                    <option value="0-1">Less than 1 year</option>
                    <option value="1-3">1-3 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="5+">5+ years</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Are you a...</label>
                <div className="flex gap-4">
                  {['solo', 'organization'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="detailerType"
                        value={type}
                        checked={formData.detailerType === type}
                        onChange={(e) => setFormData(prev => ({ ...prev, detailerType: e.target.value }))}
                        className="w-4 h-4 accent-cyan-500"
                      />
                      <span className="capitalize">{type === 'solo' ? 'Solo Detailer' : 'Organization / Team'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Services You Offer *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {services.map((service) => (
                    <label
                      key={service}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        formData.services.includes(service)
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.services.includes(service)}
                        onChange={() => handleServiceToggle(service)}
                        className="sr-only"
                      />
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                        formData.services.includes(service)
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-slate-600'
                      }`}>
                        {formData.services.includes(service) && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </span>
                      <span className="text-sm">{service}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Instagram / Website <span className="text-slate-500">(optional)</span></label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://instagram.com/yourhandle"
                  value={formData.socialLink}
                  onChange={(e) => setFormData(prev => ({ ...prev, socialLink: e.target.value }))}
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium mb-2">Message / Notes <span className="text-slate-500">(optional)</span></label>
                <textarea
                  className="input min-h-[120px] resize-none"
                  placeholder="Tell us anything else you'd like us to know..."
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>

              <p className="text-center text-slate-500 text-sm mt-4">
                We&apos;ll review your application and get back to you within 24-48 hours.
              </p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
