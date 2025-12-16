import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - CleanSwift",
  description: "CleanSwift Privacy Policy - Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="prose prose-invert prose-lg max-w-none">
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 text-gradient">
            Privacy Policy
          </h1>
          
          <p className="text-[#94a3b8] mb-8">
            <strong>Last Updated:</strong> December 2024
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                1. Introduction
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                Welcome to CleanSwift ("we," "our," or "us"). CleanSwift is a car detailing booking platform 
                that connects customers with professional service providers. This Privacy Policy explains how 
                we collect, use, disclose, and safeguard your information when you use our mobile application 
                and services.
              </p>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                By using CleanSwift, you agree to the collection and use of information in accordance with 
                this policy. If you do not agree with our policies and practices, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                2. Information We Collect
              </h2>
              
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">2.1 Account Information</h3>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Email address</li>
                <li>Full name</li>
                <li>Phone number</li>
                <li>Profile information</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.2 Payment Information</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                Payment information is processed securely through Stripe. We do not store your full credit card 
                details on our servers. Stripe handles all payment processing and stores payment information 
                according to their privacy policy and PCI-DSS compliance standards.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.3 Vehicle Information</h3>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Vehicle make, model, and year</li>
                <li>Vehicle type and size</li>
                <li>License plate information (if provided)</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.4 Location Data</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                We collect location data, including service addresses, to facilitate booking and service delivery. 
                This information is used to match you with nearby service providers and for navigation purposes.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.5 Booking History</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                We maintain records of your booking history, including dates, times, services requested, and 
                service provider information.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.6 Reviews and Ratings</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                When you provide reviews or ratings for services, we collect and store this information to help 
                improve our platform and assist other users in making informed decisions.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-[#f8fafc]">2.7 Usage Data</h3>
              <p className="text-[#cbd5e1] leading-relaxed">
                We automatically collect certain information when you use our app, including device information, 
                IP address, browser type, access times, and pages viewed.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>To provide, maintain, and improve our services</li>
                <li>To process bookings and facilitate service delivery</li>
                <li>To process payments and manage transactions</li>
                <li>To communicate with you about your bookings, account, and our services</li>
                <li>To send you promotional materials and updates (with your consent)</li>
                <li>To respond to your inquiries and provide customer support</li>
                <li>To detect, prevent, and address technical issues and fraud</li>
                <li>To comply with legal obligations and enforce our terms</li>
                <li>To analyze usage patterns and improve user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                4. Third-Party Services
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                We use the following third-party services that may collect or process your information:
              </p>
              
              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.1 Stripe</h3>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                We use Stripe for payment processing. Stripe's privacy policy can be found at{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" 
                   className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  https://stripe.com/privacy
                </a>.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.2 Supabase</h3>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                We use Supabase for authentication and database services. Supabase's privacy policy can be found at{" "}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" 
                   className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  https://supabase.com/privacy
                </a>.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.3 Google Maps API</h3>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                We use Google Maps API for geocoding and location services. Google's privacy policy can be found at{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" 
                   className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  https://policies.google.com/privacy
                </a>.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.4 Apple Sign-In</h3>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                If you choose to sign in with Apple, Apple's privacy policy applies. You can review it at{" "}
                <a href="https://www.apple.com/privacy" target="_blank" rel="noopener noreferrer" 
                   className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  https://www.apple.com/privacy
                </a>.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-[#f8fafc]">4.5 Google Sign-In</h3>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                If you choose to sign in with Google, Google's privacy policy applies. You can review it at{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" 
                   className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  https://policies.google.com/privacy
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                5. Data Retention
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                We retain your information for different periods depending on the type of data:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>
                  <strong>Booking History:</strong> We retain booking records for 7 years to comply with tax 
                  and accounting requirements.
                </li>
                <li>
                  <strong>Account Information:</strong> We retain your account information for as long as your 
                  account is active or as needed to provide services.
                </li>
                <li>
                  <strong>Other Data:</strong> We retain other personal data for as long as necessary to fulfill 
                  the purposes outlined in this policy, unless a longer retention period is required by law.
                </li>
              </ul>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                When you delete your account, we will delete or anonymize your personal information, except where 
                we are required to retain it for legal, tax, or accounting purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                6. Your Rights
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>
                  <strong>Access:</strong> You have the right to request access to the personal information we 
                  hold about you.
                </li>
                <li>
                  <strong>Correction:</strong> You have the right to request correction of inaccurate or incomplete 
                  personal information.
                </li>
                <li>
                  <strong>Deletion:</strong> You have the right to request deletion of your personal information, 
                  subject to certain exceptions.
                </li>
                <li>
                  <strong>Data Portability:</strong> You have the right to receive your personal information in a 
                  structured, commonly used, and machine-readable format.
                </li>
                <li>
                  <strong>Opt-Out:</strong> You have the right to opt-out of certain uses of your information, 
                  such as marketing communications.
                </li>
                <li>
                  <strong>Objection:</strong> You have the right to object to processing of your personal 
                  information in certain circumstances.
                </li>
              </ul>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                To exercise any of these rights, please contact us at{" "}
                <a href="mailto:support@cleanswift.app" className="text-[#22d3ee] hover:text-[#06b6d4] underline">
                  support@cleanswift.app
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                7. Security Measures
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                We implement appropriate technical and organizational security measures to protect your personal 
                information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#cbd5e1]">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and authorization systems</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and employee training</li>
                <li>Compliance with industry-standard security practices</li>
              </ul>
              <p className="text-[#cbd5e1] leading-relaxed mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While 
                we strive to use commercially acceptable means to protect your information, we cannot guarantee 
                absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                8. International Data Transfers
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of 
                residence. These countries may have data protection laws that differ from those in your country. 
                We take appropriate safeguards to ensure that your personal information receives an adequate level 
                of protection.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                9. Children's Privacy
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                CleanSwift is intended for users who are 18 years of age or older. We do not knowingly collect 
                personal information from children under 18. If you are a parent or guardian and believe your 
                child has provided us with personal information, please contact us immediately. If we become aware 
                that we have collected personal information from a child under 18, we will take steps to delete 
                such information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                10. Changes to This Privacy Policy
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review 
                this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when 
                they are posted on this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-4 text-[#22d3ee]">
                11. Contact Us
              </h2>
              <p className="text-[#cbd5e1] leading-relaxed mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
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

