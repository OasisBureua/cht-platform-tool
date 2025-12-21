import { Card } from '../components/ui/Card';
import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

export default function Payments() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payment Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your payment account and view transaction history.
        </p>
      </div>

      {/* Setup Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800">
            <strong>Payment integration coming soon!</strong> Stripe Connect
            onboarding will be available once Auth0 authentication is configured.
          </p>
        </div>
      </div>

      {/* Payment Account Status */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Payment Account
            </h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
              Not Connected
            </span>
          </div>

          <p className="text-sm text-gray-600">
            Connect your bank account to receive honorarium payments directly.
          </p>

          <button className="btn-primary" disabled>
            <CreditCard className="w-4 h-4 mr-2" />
            Connect Bank Account
          </button>
        </div>
      </Card>

      {/* What You'll Need */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          What You'll Need
        </h2>
        <ul className="space-y-3">
          {[
            'Valid government-issued ID',
            'Social Security Number or EIN',
            'Bank account and routing number',
            'Business information (if applicable)',
          ].map((item, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Payment Schedule */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Payment Schedule
        </h2>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Honorarium Payments:</strong> Processed within 2-3 business
            days after program completion
          </p>
          <p>
            <strong>Survey Bonuses:</strong> Processed within 1 business day
            after survey submission
          </p>
          <p>
            <strong>Transfer Time:</strong> Funds typically arrive in your bank
            account within 2-3 business days
          </p>
        </div>
      </Card>
    </div>
  );
}
