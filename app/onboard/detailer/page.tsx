'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';
import OnboardingStep from '@/app/components/onboard/OnboardingStep';
import AddressForm from '@/app/components/onboard/AddressForm';
import SpecialtiesSelector from '@/app/components/onboard/SpecialtiesSelector';
import PendingApprovalMessage from '@/app/components/onboard/PendingApprovalMessage';
import { createDetailerProfile, type DetailerOnboardingData, type AddressData } from '@/app/onboard/actions';
import AvailabilitySelector from '@/app/components/onboard/AvailabilitySelector';
import PricingModelSelector from '@/app/components/onboard/PricingModelSelector';

const TOTAL_STEPS = 6;

export default function SoloDetailerOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [formData, setFormData] = useState<DetailerOnboardingData>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    years_experience: 0,
    address: {
      address_line1: '',
      city: '',
      province: '',
      postal_code: '',
    },
    service_radius_km: 50,
    bio: '',
    specialties: [],
    availability: [],
    daysOff: [],
    pricing_model: null,
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        // Only pre-fill email for logged-in users, but NOT name, phone, or other fields
        // Users should enter their own information during onboarding
        setFormData(prev => ({
          ...prev,
          email: user.email || '',
        }));
      } else {
        setIsLoggedIn(false);
      }
    }
    fetchUser();
  }, [supabase]);

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<string, string>> = {};

    if (step === 1) {
      // If not logged in, require email and password
      if (!isLoggedIn) {
        if (!formData.email?.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Please enter a valid email address';
        }
        if (!formData.password?.trim()) {
          newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        }
      }
      
      if (!formData.full_name.trim()) {
        newErrors.full_name = 'Full name is required';
      }
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      }
      if (!formData.years_experience || formData.years_experience < 0) {
        newErrors.years_experience = 'Years of experience is required';
      }
    } else if (step === 2) {
      if (!formData.address.address_line1.trim()) {
        newErrors['address.address_line1'] = 'Street address is required';
      }
      if (!formData.address.city.trim()) {
        newErrors['address.city'] = 'City is required';
      }
      if (!formData.address.province.trim()) {
        newErrors['address.province'] = 'Province is required';
      }
      if (!formData.address.postal_code.trim()) {
        newErrors['address.postal_code'] = 'Postal code is required';
      }
      // Validate that lat/lng is captured (required for distance-based matching)
      if (!formData.address.latitude || !formData.address.longitude) {
        newErrors['address.location'] = 'Please select your address from the autocomplete suggestions to enable location-based matching';
      }
      // Validate service radius
      if (!formData.service_radius_km || formData.service_radius_km < 1) {
        newErrors['service_radius_km'] = 'Service radius must be at least 1 km';
      }
      if (formData.service_radius_km && formData.service_radius_km > 200) {
        newErrors['service_radius_km'] = 'Service radius cannot exceed 200 km';
      }
    } else if (step === 3) {
      if (!formData.pricing_model) {
        newErrors.pricing_model = 'Please select a pricing model';
      }
    } else if (step === 5) {
      // Availability is optional, but if provided, validate times
      if (formData.availability && formData.availability.length > 0) {
        formData.availability.forEach((slot, index) => {
          if (slot.end_time <= slot.start_time) {
            newErrors[`availability.${index}`] = 'End time must be after start time';
          }
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createDetailerProfile(formData);
      
      if (result.success) {
        setSubmitted(true);
        // Sign out the user and redirect to home page after a short delay
        setTimeout(async () => {
          await supabase.auth.signOut();
          router.push('/');
        }, 3000);
      } else {
        setErrors({ submit: result.error || 'Failed to submit application' });
        setIsSubmitting(false);
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'An error occurred' });
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen">
        <Navigation />
        <PendingApprovalMessage />
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Navigation />
      
      <section className="py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none z-0" />
        
        <div className="relative z-10">
        {currentStep === 1 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Basic Information"
            description="Tell us about yourself"
            onNext={handleNext}
            canProceed={
              (isLoggedIn || (!!formData.email && !!formData.password && formData.password.length >= 6)) &&
              !!formData.full_name && 
              !!formData.phone && 
              formData.years_experience > 0
            }
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="John Smith"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
                {errors.full_name && (
                  <p className="text-red-400 text-sm mt-1">{errors.full_name}</p>
                )}
              </div>

              {!isLoggedIn ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      className="input"
                      placeholder="you@example.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    {errors.email && (
                      <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="input"
                      placeholder="At least 6 characters"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    {errors.password && (
                      <p className="text-red-400 text-sm mt-1">{errors.password}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">Password must be at least 6 characters</p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    disabled
                    className="input opacity-60 cursor-not-allowed"
                    value={formData.email || ''}
                  />
                  <p className="text-slate-500 text-xs mt-1">Email cannot be changed</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  className="input"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                {errors.phone && (
                  <p className="text-red-400 text-sm mt-1">{errors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Years of Experience <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="input"
                  placeholder="5"
                  value={formData.years_experience || ''}
                  onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
                />
                {errors.years_experience && (
                  <p className="text-red-400 text-sm mt-1">{errors.years_experience}</p>
                )}
              </div>
            </div>
          </OnboardingStep>
        )}

        {currentStep === 2 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Location & Service Area"
            description="Where will you be providing services?"
            onNext={handleNext}
            onBack={handleBack}
            canProceed={
              !!formData.address.address_line1 &&
              !!formData.address.city &&
              !!formData.address.province &&
              !!formData.address.postal_code &&
              !!formData.address.latitude &&
              !!formData.address.longitude &&
              !!formData.service_radius_km &&
              formData.service_radius_km >= 1 &&
              formData.service_radius_km <= 200
            }
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <AddressForm
                value={formData.address}
                onChange={(address) => setFormData({ ...formData, address })}
                errors={errors}
              />

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Travel Radius (km) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  className="input"
                  placeholder="50"
                  value={formData.service_radius_km || ''}
                  onChange={(e) => setFormData({ ...formData, service_radius_km: parseInt(e.target.value) || 50 })}
                />
                <p className="text-slate-500 text-xs mt-1">How far are you willing to travel from your home base? This determines which bookings you'll be matched with.</p>
                {errors['service_radius_km'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['service_radius_km']}</p>
                )}
                {errors['address.location'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['address.location']}</p>
                )}
              </div>
            </div>
          </OnboardingStep>
        )}

        {currentStep === 3 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Pricing Model"
            description="Choose how you want to pay the platform"
            onNext={handleNext}
            onBack={handleBack}
            canProceed={!!formData.pricing_model}
            isSubmitting={isSubmitting}
          >
            <PricingModelSelector
              selected={formData.pricing_model ?? null}
              onChange={(model) => setFormData({ ...formData, pricing_model: model })}
              errors={errors}
            />
          </OnboardingStep>
        )}

        {currentStep === 4 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Profile Details"
            description="Help customers get to know you"
            onNext={handleNext}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Bio <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  className="input min-h-[120px] resize-none"
                  placeholder="Tell customers about your experience, what makes you unique, and why they should choose you..."
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
                <p className="text-slate-500 text-xs mt-1">This will appear on your public profile</p>
              </div>

              <SpecialtiesSelector
                selected={formData.specialties || []}
                onChange={(specialties) => setFormData({ ...formData, specialties })}
              />
            </div>
          </OnboardingStep>
        )}

        {currentStep === 5 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Availability Hours"
            description="When are you available to work? Jobs will only be assigned during these hours."
            onNext={handleNext}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <p className="text-sm text-cyan-300">
                  <strong>Note:</strong> Select the days and times you&apos;re available to work. 
                  You can update this later in your settings.
                </p>
              </div>

              <AvailabilitySelector
                value={formData.availability || []}
                onChange={(availability) => setFormData({ ...formData, availability })}
                daysOff={formData.daysOff || []}
                onDaysOffChange={(daysOff) => setFormData({ ...formData, daysOff })}
                errors={errors}
              />
            </div>
          </OnboardingStep>
        )}

        {currentStep === 6 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Review & Submit"
            description="Review your information before submitting"
            onBack={handleBack}
            onNext={handleSubmit}
            nextLabel="Submit Application"
            canProceed={true}
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <h3 className="font-semibold mb-4">Basic Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Full Name:</dt>
                    <dd className="font-medium">{formData.full_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Email:</dt>
                    <dd className="font-medium">{formData.email || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Phone:</dt>
                    <dd className="font-medium">{formData.phone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Years of Experience:</dt>
                    <dd className="font-medium">{formData.years_experience}</dd>
                  </div>
                </dl>
              </div>

              <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <h3 className="font-semibold mb-4">Location & Service Area</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-400">Address:</dt>
                    <dd className="font-medium mt-1">
                      {formData.address.address_line1}
                      {formData.address.address_line2 && `, ${formData.address.address_line2}`}
                      <br />
                      {formData.address.city}, {formData.address.province} {formData.address.postal_code}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Service Radius:</dt>
                    <dd className="font-medium">{formData.service_radius_km || 50} km</dd>
                  </div>
                </dl>
              </div>

              <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <h3 className="font-semibold mb-4">Pricing Model</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Model:</dt>
                    <dd className="font-medium">
                      {formData.pricing_model === 'subscription' 
                        ? 'Monthly Subscription ($29.99/month)' 
                        : formData.pricing_model === 'percentage'
                        ? 'Pay Per Booking (15% platform fee)'
                        : 'Not selected'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <h3 className="font-semibold mb-4">Profile Details</h3>
                <dl className="space-y-2 text-sm">
                  {formData.bio && (
                    <div>
                      <dt className="text-slate-400">Bio:</dt>
                      <dd className="font-medium mt-1">{formData.bio}</dd>
                    </div>
                  )}
                  {formData.specialties && formData.specialties.length > 0 && (
                    <div>
                      <dt className="text-slate-400">Specialties:</dt>
                      <dd className="font-medium mt-1">
                        {formData.specialties.join(', ')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {formData.availability && formData.availability.length > 0 && (
                <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <h3 className="font-semibold mb-4">Availability Hours</h3>
                  <dl className="space-y-2 text-sm">
                    {formData.availability.map((slot) => {
                      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const startTime = slot.start_time.substring(0, 5);
                      const endTime = slot.end_time.substring(0, 5);
                      return (
                        <div key={slot.day_of_week} className="flex justify-between">
                          <dt className="text-slate-400">{DAY_NAMES[slot.day_of_week]}:</dt>
                          <dd className="font-medium">{startTime} - {endTime}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}

              {errors.submit && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{errors.submit}</p>
                </div>
              )}

              <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <p className="text-sm text-cyan-300">
                  <strong>Note:</strong> After submission, your application will be reviewed by an admin. 
                  You&apos;ll receive an email notification once your account is approved.
                </p>
              </div>
            </div>
          </OnboardingStep>
        )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
