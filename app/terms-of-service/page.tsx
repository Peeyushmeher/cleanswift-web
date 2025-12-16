import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - CleanSwift",
  description: "CleanSwift Terms of Service - Read our terms and conditions for using our car detailing booking platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="prose prose-invert prose-lg max-w-none">
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 text-gradient">
            Terms of Service
          </h1>
          
          <p className="text-[#94a3b8] mb-8">
            <strong>Last Updated:</strong> December 2024
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                1. Agreement to Terms
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                By accessing or using CleanSwift ("the Service"), you agree to be bound by these Terms of Service 
                ("Terms"). If you disagree with any part of these terms, you may not access the Service.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                CleanSwift is a car detailing booking platform that connects customers with professional service 
                providers. These Terms govern your use of our mobile application and services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                2. Service Description
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                CleanSwift provides a platform that enables users to book car detailing services from independent 
                service providers. We facilitate the connection between customers and service providers but are not 
                a party to the actual service agreement between you and the service provider.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                3. Account Requirements
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">3.1 Age Requirement</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                You must be at least 18 years old to use CleanSwift. By using the Service, you represent and 
                warrant that you are 18 years of age or older.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">3.2 Account Information</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                You agree to provide accurate, current, and complete information when creating an account and to 
                update such information to keep it accurate, current, and complete. You are responsible for 
                maintaining the confidentiality of your account credentials.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">3.3 Account Security</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                You are responsible for all activities that occur under your account. You agree to notify us 
                immediately of any unauthorized use of your account or any other breach of security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                4. Booking Terms
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.1 Availability</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                All bookings are subject to service provider availability. We do not guarantee that a service 
                provider will be available at your requested time or location.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">4.2 Vehicle and Location Information</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                You must provide accurate vehicle information (make, model, year, type) and service location. 
                Providing inaccurate information may result in service delays, additional charges, or service 
                cancellation.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">4.3 Service Access</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                You are responsible for ensuring that the service provider has safe and appropriate access to 
                your vehicle at the scheduled service time and location.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                5. Cancellation Policy
              </h2>
              <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6 mb-4">
                <h3 className="text-xl font-semibold mb-3 text-[#22d3ee]">5.1 Free Cancellation</h3>
                <p className="text-[#cbd5e1] leading-relaxed">
                  You may cancel your booking free of charge up to <strong className="text-[#f8fafc]">4 hours 
                  before</strong> the scheduled service time.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6 text-[#22d3ee]">5.2 Late Cancellation</h3>
                <p className="text-[#cbd5e1] leading-relaxed">
                  Cancellations made less than 4 hours before the scheduled service time may incur a cancellation 
                  fee, as the service provider may have already committed to your booking.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6 text-[#22d3ee]">5.3 No-Show Policy</h3>
                <p className="text-[#cbd5e1] leading-relaxed">
                  If you fail to be present or provide access to your vehicle at the scheduled service time 
                  without prior cancellation ("no-show"), you will be charged the full service amount.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                6. Rescheduling
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                You may reschedule your booking up to <strong className="text-[#f8fafc]">2 hours before</strong> 
                the scheduled service time, subject to service provider availability. Rescheduling requests made 
                less than 2 hours before service time may not be accommodated and may be treated as a cancellation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                7. Payment Terms
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">7.1 Payment Processing</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Payment is processed at the time of booking through Stripe. We accept major credit cards and 
                Apple Pay. All payments are processed securely and in accordance with PCI-DSS standards.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">7.2 Pricing</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                All prices are displayed in your local currency and are subject to change. The price charged 
                will be the price displayed at the time of booking confirmation.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">7.3 Additional Charges</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Additional charges may apply for extra services requested during the service, oversized vehicles, 
                or special circumstances. These charges will be communicated to you before being applied.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                8. Refunds
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                Refund policies are detailed in our Refund Policy. In general:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Refunds are processed within 5-10 business days</li>
                <li>No refunds are provided for completed services unless there is a material service failure</li>
                <li>Refund eligibility is determined on a case-by-case basis</li>
              </ul>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                For detailed refund information, please see our{" "}
                <a href="/refund-policy" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  Refund Policy
                </a> or contact us at{" "}
                <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  support@cleanswift.app
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                9. User Conduct
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Harass, abuse, or harm service providers or other users</li>
                <li>Engage in fraudulent, deceptive, or misleading practices</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                10. Service Provider Relationship
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">10.1 Independent Contractors</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Service providers are independent contractors, not employees or agents of CleanSwift. We are not 
                responsible for the quality, safety, or legality of services provided by service providers.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">10.2 Quality Standards</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                While we expect service providers to maintain high standards, we do not guarantee the quality of 
                services. You are encouraged to review service provider ratings and reviews before booking.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">10.3 Dispute Resolution</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                If you have a dispute with a service provider, please contact us at{" "}
                <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  support@cleanswift.app
                </a>. We will attempt to facilitate resolution but are not obligated to resolve disputes between 
                users and service providers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                11. Limitation of Liability
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLEANSWIFT SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, 
                WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE 
                LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                Our total liability to you for all claims arising from or related to the use of the Service shall 
                not exceed the amount you paid to us in the 12 months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                12. Indemnification
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                You agree to indemnify, defend, and hold harmless CleanSwift, its officers, directors, employees, 
                and agents from and against any claims, liabilities, damages, losses, and expenses, including 
                reasonable attorneys' fees, arising out of or in any way connected with your use of the Service, 
                violation of these Terms, or infringement of any rights of another.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                13. Dispute Resolution
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">13.1 Arbitration</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Any dispute arising out of or relating to these Terms or the Service shall be resolved through 
                binding arbitration in accordance with the rules of [ARBITRATION ORGANIZATION], except where 
                prohibited by law.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">13.2 Class Action Waiver</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                You agree that any dispute resolution proceedings will be conducted only on an individual basis 
                and not in a class, consolidated, or representative action.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                14. Termination
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without prior 
                notice or liability, for any reason, including if you breach these Terms. Upon termination, your 
                right to use the Service will cease immediately.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                You may terminate your account at any time by contacting us at{" "}
                <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  support@cleanswift.app
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                15. Changes to Terms
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we 
                will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a 
                material change will be determined at our sole discretion.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                By continuing to access or use the Service after those revisions become effective, you agree to 
                be bound by the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                16. Governing Law
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of [JURISDICTION], 
                without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                17. Contact Information
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6">
                <p className="text-[#cbd5e1]">
                  <strong className="text-[#f8fafc]">Email:</strong>{" "}
                  <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                    support@cleanswift.app
                  </a>
                </p>
                <p className="text-[#cbd5e1] mt-2">
                  <strong className="text-[#f8fafc]">Business Address:</strong> [YOUR BUSINESS ADDRESS]
                </p>
                <p className="text-[#cbd5e1] mt-2">
                  <strong className="text-[#f8fafc]">Jurisdiction:</strong> [JURISDICTION]
                </p>
              </div>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-[rgba(148,163,184,0.1)]">
            <p className="text-[#94a3b8] text-sm">
              © {new Date().getFullYear()} CleanSwift. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

