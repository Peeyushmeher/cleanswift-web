import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy - CleanSwift",
  description: "CleanSwift Refund Policy - Learn about our cancellation and refund policies for car detailing services.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="prose prose-invert prose-lg max-w-none">
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 text-gradient">
            Refund Policy
          </h1>
          
          <p className="text-[#94a3b8] mb-8">
            <strong>Last Updated:</strong> December 2024
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                1. Overview
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                This Refund Policy explains how refunds are handled for bookings made through CleanSwift. This 
                policy applies to all users of our car detailing booking platform. By using CleanSwift, you agree 
                to this Refund Policy.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                For questions about refunds, please contact us at{" "}
                <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  support@cleanswift.app
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                2. Cancellation and Refund Eligibility
              </h2>
              
              <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold mb-3 text-[#22d3ee]">2.1 Free Cancellation Period</h3>
                <p className="text-[#cbd5e1] leading-relaxed">
                  You may cancel your booking <strong className="text-[#f8fafc]">free of charge up to 4 hours 
                  before</strong> the scheduled service time. When you cancel within this period, you will receive 
                  a full refund.
                </p>
              </div>

              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">2.2 Late Cancellation</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Cancellations made less than 4 hours before the scheduled service time may incur a cancellation 
                fee. The amount of the fee depends on the timing of the cancellation and the service provider's 
                policies. Partial refunds may be available at our discretion.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.3 No-Show Policy</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                If you fail to be present or provide access to your vehicle at the scheduled service time without 
                prior cancellation ("no-show"), you will be charged the full service amount and no refund will be 
                provided.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                3. Completed Services
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                <strong className="text-[#f8fafc]">No refunds are provided for completed services</strong>, except 
                in cases of material service failure. A material service failure may include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Service provider did not arrive at the scheduled time and location</li>
                <li>Service was not performed as described or agreed upon</li>
                <li>Service caused damage to your vehicle (subject to verification)</li>
                <li>Service provider engaged in unprofessional or unsafe conduct</li>
              </ul>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                If you believe you have experienced a material service failure, please contact us at{" "}
                <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  support@cleanswift.app
                </a> within 24 hours of service completion. We will investigate your claim and determine refund 
                eligibility on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                4. Refund Processing
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.1 Processing Time</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Refunds are typically processed within <strong className="text-[#f8fafc]">5-10 business days</strong> 
                after approval. The exact timing may vary depending on your payment method and financial institution.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">4.2 Refund Method</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Refunds will be issued to the original payment method used for the booking. If the original payment 
                method is no longer available, we will work with you to arrange an alternative refund method.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">4.3 Partial Refunds</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                In some cases, partial refunds may be issued. For example, if you cancel late but the service provider 
                has not yet departed for your location, a partial refund may be available. The amount of any partial 
                refund will be determined on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                5. Service Provider Cancellations
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                If a service provider cancels your booking, you will receive a full refund automatically. We will 
                notify you as soon as possible if a service provider cancels, and we will work to help you find an 
                alternative service provider if desired.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                6. Weather and Force Majeure
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                In cases of severe weather or other circumstances beyond our control that prevent service delivery, 
                we will work with you to reschedule the service or provide a full refund. Such circumstances may 
                include natural disasters, extreme weather conditions, or government-mandated restrictions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                7. Rescheduling vs. Refunds
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                If you need to change your service time, you may reschedule your booking up to 2 hours before the 
                scheduled service time (subject to availability). Rescheduling is often preferable to cancellation, 
                as it allows you to receive the service at a more convenient time without losing your payment.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                If rescheduling is not possible or you prefer a refund, standard cancellation and refund policies 
                apply.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                8. Disputes and Appeals
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                If you disagree with a refund decision, you may contact us to appeal. Please provide detailed 
                information about your booking and the reason for your refund request. We will review your appeal 
                and respond within 5-7 business days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                9. Contact Us for Refund Requests
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                To request a refund, please contact us with the following information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Your booking confirmation number</li>
                <li>The date and time of your scheduled service</li>
                <li>The reason for your refund request</li>
                <li>Any relevant photos or documentation (for service failure claims)</li>
              </ul>
              <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6 mt-6">
                <p className="text-[#cbd5e1]">
                  <strong className="text-[#f8fafc]">Email:</strong>{" "}
                  <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                    support@cleanswift.app
                  </a>
                </p>
                <p className="text-[#cbd5e1] mt-2">
                  Please include "Refund Request" in the subject line for faster processing.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                10. Changes to This Policy
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                We may update this Refund Policy from time to time. We will notify you of any material changes by 
                posting the new policy on this page and updating the "Last Updated" date. Your continued use of 
                CleanSwift after any changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                11. Related Policies
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                This Refund Policy should be read in conjunction with our{" "}
                <a href="/terms-of-service" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  Terms of Service
                </a> and{" "}
                <a href="/privacy-policy" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  Privacy Policy
                </a>.
              </p>
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

