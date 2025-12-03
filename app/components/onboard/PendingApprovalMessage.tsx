'use client';

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default function PendingApprovalMessage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="card p-8 lg:p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto mb-6">
          <CheckIcon />
        </div>
        
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
          Application Submitted!
        </h2>
        
        <p className="text-slate-400 text-lg mb-8">
          Thank you for completing the onboarding process. Your application has been received and is now pending admin review.
        </p>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <ClockIcon />
            </div>
            <div className="text-left">
              <h3 className="font-semibold mb-2">What Happens Next?</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>An admin will review your application within 48 hours</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>We&apos;ll give you a call to confirm your details and approve you as a detailer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>Once approved, you&apos;ll have full access to your detailer dashboard</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
          <p className="text-sm text-cyan-300">
            <strong>Note:</strong> You&apos;ll be redirected to the home page shortly. Once your account is approved by an admin, 
            you&apos;ll receive an email notification. You can then log in with your credentials to access your detailer dashboard. 
            We appreciate your patience during the review process.
          </p>
        </div>
      </div>
    </div>
  );
}
