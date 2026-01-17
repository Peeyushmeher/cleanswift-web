import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - CleanSwift",
  description: "Get help with CleanSwift - Contact our support team, find answers to frequently asked questions, and learn how to use our car detailing booking platform.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="prose prose-invert prose-lg max-w-none">
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 text-gradient">
            Support
          </h1>
          
          <p className="text-[#94a3b8] mb-8 text-lg">
            We&apos;re here to help. Find answers to common questions or contact our support team.
          </p>

          <div className="space-y-10">
            {/* Contact Section */}
            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                Contact Us
              </h2>
              <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6">
                <p className="text-[#cbd5e1] mb-4">
                  Have a question or need assistance? Our support team is ready to help.
                </p>
                <div className="space-y-3">
                  <p className="text-[#cbd5e1]">
                    <strong className="text-[#f8fafc]">Email:</strong>{" "}
                    <a href="mailto:cleanswift.app@gmail.com" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                      cleanswift.app@gmail.com
                    </a>
                  </p>
                  <p className="text-[#cbd5e1]">
                    <strong className="text-[#f8fafc]">Response Time:</strong> We typically respond within 24-48 hours
                  </p>
                  <p className="text-[#cbd5e1]">
                    <strong className="text-[#f8fafc]">Business Address:</strong> 45 Epps Crescent, Ajax, Ontario L1Z 1G2, Canada
                  </p>
                </div>
              </div>
            </section>

            {/* FAQ Section */}
            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-6 text-[#22d3ee]">
                Frequently Asked Questions
              </h2>
              
              <div className="space-y-6">
                {/* Booking FAQs */}
                <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-[#f8fafc]">Booking & Scheduling</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How do I book a car detailing service?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Open the CleanSwift app, select your vehicle type and preferred service, choose an available 
                        time slot, enter your service location, and complete payment. You&apos;ll receive a confirmation 
                        with your detailer&apos;s details.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">Can I reschedule my booking?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Yes, you can reschedule your booking up to 2 hours before the scheduled service time, 
                        subject to detailer availability. Go to your bookings in the app and select &quot;Reschedule.&quot;
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">What is the cancellation policy?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Free cancellation is available up to 4 hours before your scheduled service. Cancellations 
                        made less than 4 hours before service time may incur a cancellation fee. No-shows are 
                        charged the full service amount.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment FAQs */}
                <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-[#f8fafc]">Payments & Refunds</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">What payment methods do you accept?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        We accept all major credit cards (Visa, Mastercard, American Express) and Apple Pay. 
                        All payments are processed securely through Stripe.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">When am I charged for a booking?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Payment is processed at the time of booking to confirm your appointment with the detailer.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How do I request a refund?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        If you&apos;re not satisfied with your service or experienced an issue, please contact us at{" "}
                        <a href="mailto:cleanswift.app@gmail.com" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                          cleanswift.app@gmail.com
                        </a>
                        . Refunds are processed within 5-10 business days. See our{" "}
                        <a href="/refund-policy" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                          Refund Policy
                        </a>{" "}
                        for details.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Account FAQs */}
                <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-[#f8fafc]">Account & Privacy</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How do I create an account?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Download CleanSwift from the App Store and sign up using your email, Apple ID, or Google 
                        account. You&apos;ll need to provide your name and phone number to complete registration.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How do I reset my password?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        On the login screen, tap &quot;Forgot Password&quot; and enter your email address. You&apos;ll receive 
                        a password reset link. If you signed up with Apple or Google, use those services to sign in.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How do I delete my account?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        To delete your account and associated data, please email us at{" "}
                        <a href="mailto:cleanswift.app@gmail.com" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                          cleanswift.app@gmail.com
                        </a>
                        . We&apos;ll process your request and confirm deletion within 30 days.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How is my data protected?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        We take your privacy seriously. Your data is encrypted and stored securely. We never sell 
                        your personal information. Read our full{" "}
                        <a href="/privacy-policy" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                          Privacy Policy
                        </a>{" "}
                        for details.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service FAQs */}
                <div className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-[#f8fafc]">Service & Detailers</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">How are detailers vetted?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        All detailers on CleanSwift go through a verification process. They must provide valid 
                        identification, proof of insurance, and demonstrate their expertise. We also monitor 
                        ratings and reviews to maintain quality standards.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">What if I&apos;m not satisfied with the service?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Your satisfaction is important to us. If you&apos;re not happy with a service, contact us 
                        within 24 hours at{" "}
                        <a href="mailto:cleanswift.app@gmail.com" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                          cleanswift.app@gmail.com
                        </a>
                        . We&apos;ll work with you and the detailer to resolve any issues.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-[#22d3ee] font-medium mb-2">Do I need to be present during the service?</h4>
                      <p className="text-[#cbd5e1] text-base">
                        Yes, you should be present or ensure someone is available to provide the detailer access 
                        to your vehicle at the scheduled time and location.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Links */}
            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                Quick Links
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a 
                  href="/privacy-policy" 
                  className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-4 hover:border-[#22d3ee] transition-colors no-underline"
                >
                  <h3 className="text-[#f8fafc] font-semibold mb-1">Privacy Policy</h3>
                  <p className="text-[#94a3b8] text-sm">How we handle your data</p>
                </a>
                <a 
                  href="/terms-of-service" 
                  className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-4 hover:border-[#22d3ee] transition-colors no-underline"
                >
                  <h3 className="text-[#f8fafc] font-semibold mb-1">Terms of Service</h3>
                  <p className="text-[#94a3b8] text-sm">Our terms and conditions</p>
                </a>
                <a 
                  href="/refund-policy" 
                  className="bg-[#0f172a] border border-[rgba(148,163,184,0.1)] rounded-lg p-4 hover:border-[#22d3ee] transition-colors no-underline"
                >
                  <h3 className="text-[#f8fafc] font-semibold mb-1">Refund Policy</h3>
                  <p className="text-[#94a3b8] text-sm">Our refund guidelines</p>
                </a>
              </div>
            </section>

            {/* Still Need Help */}
            <section>
              <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] border border-[rgba(148,163,184,0.1)] rounded-lg p-6 text-center">
                <h2 className="text-xl font-display font-semibold mb-2 text-[#f8fafc]">
                  Still need help?
                </h2>
                <p className="text-[#cbd5e1] mb-4">
                  Our support team is ready to assist you with any questions or concerns.
                </p>
                <a 
                  href="mailto:cleanswift.app@gmail.com" 
                  className="inline-block bg-[#22d3ee] hover:bg-[#06b6d4] text-[#030712] font-semibold px-6 py-3 rounded-lg transition-colors no-underline"
                >
                  Email Support
                </a>
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
