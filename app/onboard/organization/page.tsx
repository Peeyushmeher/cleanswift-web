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
import { createOrganization, type OrganizationOnboardingData, type DetailerOnboardingData, type AddressData, type ServiceAreaZone, type BusinessHours } from '@/app/onboard/actions';
import AvailabilitySelector from '@/app/components/onboard/AvailabilitySelector';

const TOTAL_STEPS = 4;

export default function OrganizationOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [formData, setFormData] = useState<OrganizationOnboardingData>({
    organization_name: '',
    organization_description: '',
    business_logo_url: '',
    service_area: [],
    business_hours: {},
    owner_detailer: {
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
    },
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        // Don't pre-fill owner detailer information - users should enter their own data during onboarding
        // Only the email is shown (read-only) since it's tied to their account
      }
    }
    fetchUser();
  }, [supabase]);

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<string, string>> = {};

    if (step === 1) {
      if (!formData.organization_name.trim()) {
        newErrors.organization_name = 'Organization name is required';
      }
    } else if (step === 2) {
      // Service area and hours are optional for now
    } else if (step === 3) {
      if (!formData.owner_detailer.full_name.trim()) {
        newErrors['owner_detailer.full_name'] = 'Full name is required';
      }
      if (!formData.owner_detailer.phone.trim()) {
        newErrors['owner_detailer.phone'] = 'Phone number is required';
      }
      if (!formData.owner_detailer.years_experience || formData.owner_detailer.years_experience < 0) {
        newErrors['owner_detailer.years_experience'] = 'Years of experience is required';
      }
      if (!formData.owner_detailer.address.address_line1.trim()) {
        newErrors['owner_detailer.address.address_line1'] = 'Street address is required';
      }
      if (!formData.owner_detailer.address.city.trim()) {
        newErrors['owner_detailer.address.city'] = 'City is required';
      }
      if (!formData.owner_detailer.address.province.trim()) {
        newErrors['owner_detailer.address.province'] = 'Province is required';
      }
      if (!formData.owner_detailer.address.postal_code.trim()) {
        newErrors['owner_detailer.address.postal_code'] = 'Postal code is required';
      }
      // Validate that lat/lng is captured (required for distance-based matching)
      if (!formData.owner_detailer.address.latitude || !formData.owner_detailer.address.longitude) {
        newErrors['owner_detailer.address.location'] = 'Please select your address from the autocomplete suggestions to enable location-based matching';
      }
      // Validate service radius
      if (!formData.owner_detailer.service_radius_km || formData.owner_detailer.service_radius_km < 1) {
        newErrors['owner_detailer.service_radius_km'] = 'Service radius must be at least 1 km';
      }
      if (formData.owner_detailer.service_radius_km && formData.owner_detailer.service_radius_km > 200) {
        newErrors['owner_detailer.service_radius_km'] = 'Service radius cannot exceed 200 km';
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
    if (!validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrganization(formData);
      
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
            title="Organization Information"
            description="Tell us about your organization"
            onNext={handleNext}
            canProceed={!!formData.organization_name.trim()}
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Organization Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="ABC Detailing Services"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                />
                {errors.organization_name && (
                  <p className="text-red-400 text-sm mt-1">{errors.organization_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  className="input min-h-[120px] resize-none"
                  placeholder="Tell us about your organization, your team, and what makes you unique..."
                  value={formData.organization_description || ''}
                  onChange={(e) => setFormData({ ...formData, organization_description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Business Logo URL <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://example.com/logo.png"
                  value={formData.business_logo_url || ''}
                  onChange={(e) => setFormData({ ...formData, business_logo_url: e.target.value })}
                />
                <p className="text-slate-500 text-xs mt-1">You can upload a logo later in your organization settings</p>
              </div>
            </div>
          </OnboardingStep>
        )}

        {currentStep === 2 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Service Area & Hours"
            description="Define your organization's service coverage and business hours"
            onNext={handleNext}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          >
            <div className="space-y-8">
              {/* Service Area Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Service Areas <span className="text-slate-500 text-sm font-normal">(optional)</span></h3>
                <p className="text-sm text-slate-400 mb-4">
                  Define the areas where your organization provides services. You can add multiple zones.
                </p>
                
                <div className="space-y-4">
                  {(formData.service_area || []).map((zone, index) => (
                    <div key={index} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-white">Zone {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const newZones = [...(formData.service_area || [])];
                            newZones.splice(index, 1);
                            setFormData({ ...formData, service_area: newZones });
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Zone Name</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Downtown Toronto"
                            value={zone.name}
                            onChange={(e) => {
                              const newZones = [...(formData.service_area || [])];
                              newZones[index] = { ...zone, name: e.target.value };
                              setFormData({ ...formData, service_area: newZones });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">City</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Toronto"
                            value={zone.city}
                            onChange={(e) => {
                              const newZones = [...(formData.service_area || [])];
                              newZones[index] = { ...zone, city: e.target.value };
                              setFormData({ ...formData, service_area: newZones });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Province</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="ON"
                            value={zone.province}
                            onChange={(e) => {
                              const newZones = [...(formData.service_area || [])];
                              newZones[index] = { ...zone, province: e.target.value };
                              setFormData({ ...formData, service_area: newZones });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Postal Codes (comma-separated)</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="M5H, M5J"
                            value={zone.postal_codes?.join(', ') || ''}
                            onChange={(e) => {
                              const newZones = [...(formData.service_area || [])];
                              const postalCodes = e.target.value.split(',').map(code => code.trim()).filter(Boolean);
                              newZones[index] = { ...zone, postal_codes: postalCodes.length > 0 ? postalCodes : undefined };
                              setFormData({ ...formData, service_area: newZones });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      const newZones = [...(formData.service_area || []), { name: '', city: '', province: '' }];
                      setFormData({ ...formData, service_area: newZones });
                    }}
                    className="w-full py-2 px-4 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800/50 transition-colors"
                  >
                    + Add Service Zone
                  </button>
                </div>
              </div>

              {/* Business Hours Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Business Hours <span className="text-slate-500 text-sm font-normal">(optional)</span></h3>
                <p className="text-sm text-slate-400 mb-4">
                  Set your organization&apos;s default business hours. These can be adjusted later.
                </p>
                
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                  <AvailabilitySelector
                    value={(formData.business_hours ? Object.entries(formData.business_hours)
                      .filter(([_, hours]) => hours.active)
                      .map(([day, hours], index) => {
                        const dayMap: { [key: string]: number } = {
                          monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
                          friday: 5, saturday: 6, sunday: 0
                        };
                        return {
                          day_of_week: dayMap[day] ?? index,
                          start_time: `${hours.start}:00`,
                          end_time: `${hours.end}:00`,
                        };
                      }) : [])}
                    onChange={(availability) => {
                      const hours: BusinessHours = {};
                      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      availability.forEach(slot => {
                        const dayName = dayNames[slot.day_of_week];
                        hours[dayName] = {
                          start: slot.start_time.substring(0, 5),
                          end: slot.end_time.substring(0, 5),
                          active: true,
                        };
                      });
                      // Add inactive days
                      dayNames.forEach(day => {
                        if (!hours[day]) {
                          hours[day] = { start: '09:00', end: '17:00', active: false };
                        }
                      });
                      setFormData({ ...formData, business_hours: hours });
                    }}
                    errors={errors}
                  />
                </div>
              </div>
            </div>
          </OnboardingStep>
        )}

        {currentStep === 3 && (
          <OnboardingStep
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            title="Owner Detailer Profile"
            description="Your information as the organization owner"
            onNext={handleNext}
            onBack={handleBack}
            canProceed={
              !!formData.owner_detailer.full_name &&
              !!formData.owner_detailer.phone &&
              formData.owner_detailer.years_experience > 0 &&
              !!formData.owner_detailer.address.address_line1 &&
              !!formData.owner_detailer.address.city &&
              !!formData.owner_detailer.address.province &&
              !!formData.owner_detailer.address.postal_code &&
              !!formData.owner_detailer.address.latitude &&
              !!formData.owner_detailer.address.longitude &&
              !!formData.owner_detailer.service_radius_km &&
              formData.owner_detailer.service_radius_km >= 1 &&
              formData.owner_detailer.service_radius_km <= 200
            }
            isSubmitting={isSubmitting}
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  disabled
                  className="input opacity-60 cursor-not-allowed"
                  value={userEmail}
                />
                <p className="text-slate-500 text-xs mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="John Smith"
                  value={formData.owner_detailer.full_name}
                  onChange={(e) => setFormData({
                    ...formData,
                    owner_detailer: { ...formData.owner_detailer, full_name: e.target.value }
                  })}
                />
                {errors['owner_detailer.full_name'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['owner_detailer.full_name']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  className="input"
                  placeholder="(555) 123-4567"
                  value={formData.owner_detailer.phone}
                  onChange={(e) => setFormData({
                    ...formData,
                    owner_detailer: { ...formData.owner_detailer, phone: e.target.value }
                  })}
                />
                {errors['owner_detailer.phone'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['owner_detailer.phone']}</p>
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
                  value={formData.owner_detailer.years_experience || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    owner_detailer: { ...formData.owner_detailer, years_experience: parseInt(e.target.value) || 0 }
                  })}
                />
                {errors['owner_detailer.years_experience'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['owner_detailer.years_experience']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-4">Home/Base Address <span className="text-red-400">*</span></label>
                <AddressForm
                  value={formData.owner_detailer.address}
                  onChange={(address) => setFormData({
                    ...formData,
                    owner_detailer: { ...formData.owner_detailer, address }
                  })}
                  errors={errors}
                />
              </div>

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
                  value={formData.owner_detailer.service_radius_km || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    owner_detailer: { ...formData.owner_detailer, service_radius_km: parseInt(e.target.value) || 50 }
                  })}
                />
                <p className="text-slate-500 text-xs mt-1">How far are you willing to travel from your home base? This determines which bookings you'll be matched with.</p>
                {errors['owner_detailer.service_radius_km'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['owner_detailer.service_radius_km']}</p>
                )}
                {errors['owner_detailer.address.location'] && (
                  <p className="text-red-400 text-sm mt-1">{errors['owner_detailer.address.location']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Bio <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  className="input min-h-[100px] resize-none"
                  placeholder="Tell us about your experience..."
                  value={formData.owner_detailer.bio || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    owner_detailer: { ...formData.owner_detailer, bio: e.target.value }
                  })}
                />
              </div>

              <SpecialtiesSelector
                selected={formData.owner_detailer.specialties || []}
                onChange={(specialties) => setFormData({
                  ...formData,
                  owner_detailer: { ...formData.owner_detailer, specialties }
                })}
              />
            </div>
          </OnboardingStep>
        )}

        {currentStep === 4 && (
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
                <h3 className="font-semibold mb-4">Organization Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Organization Name:</dt>
                    <dd className="font-medium">{formData.organization_name}</dd>
                  </div>
                  {formData.organization_description && (
                    <div>
                      <dt className="text-slate-400">Description:</dt>
                      <dd className="font-medium mt-1">{formData.organization_description}</dd>
                    </div>
                  )}
                  {formData.service_area && formData.service_area.length > 0 && (
                    <div>
                      <dt className="text-slate-400">Service Areas:</dt>
                      <dd className="font-medium mt-1">
                        {formData.service_area.map((zone, idx) => (
                          <div key={idx} className="mb-1">
                            {zone.name} - {zone.city}, {zone.province}
                            {zone.postal_codes && zone.postal_codes.length > 0 && (
                              <span className="text-slate-500"> ({zone.postal_codes.join(', ')})</span>
                            )}
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                  {formData.business_hours && Object.values(formData.business_hours).some(h => h.active) && (
                    <div>
                      <dt className="text-slate-400">Business Hours:</dt>
                      <dd className="font-medium mt-1">
                        {Object.entries(formData.business_hours)
                          .filter(([_, hours]) => hours.active)
                          .map(([day, hours]) => (
                            <div key={day} className="mb-1 capitalize">
                              {day}: {hours.start} - {hours.end}
                            </div>
                          ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="p-6 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <h3 className="font-semibold mb-4">Owner Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Full Name:</dt>
                    <dd className="font-medium">{formData.owner_detailer.full_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Email:</dt>
                    <dd className="font-medium">{userEmail}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Phone:</dt>
                    <dd className="font-medium">{formData.owner_detailer.phone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Years of Experience:</dt>
                    <dd className="font-medium">{formData.owner_detailer.years_experience}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Address:</dt>
                    <dd className="font-medium mt-1">
                      {formData.owner_detailer.address.address_line1}
                      {formData.owner_detailer.address.address_line2 && `, ${formData.owner_detailer.address.address_line2}`}
                      <br />
                      {formData.owner_detailer.address.city}, {formData.owner_detailer.address.province} {formData.owner_detailer.address.postal_code}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Service Radius:</dt>
                    <dd className="font-medium">{formData.owner_detailer.service_radius_km || 50} km</dd>
                  </div>
                  {formData.owner_detailer.bio && (
                    <div>
                      <dt className="text-slate-400">Bio:</dt>
                      <dd className="font-medium mt-1">{formData.owner_detailer.bio}</dd>
                    </div>
                  )}
                  {formData.owner_detailer.specialties && formData.owner_detailer.specialties.length > 0 && (
                    <div>
                      <dt className="text-slate-400">Specialties:</dt>
                      <dd className="font-medium mt-1">
                        {formData.owner_detailer.specialties.join(', ')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

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
