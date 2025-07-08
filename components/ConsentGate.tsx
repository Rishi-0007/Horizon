"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlaidLink from "@/components/PlaidLink";
type ConsentGateProps = {
  user: User;
  accessToken: string;
};

const ConsentGate = ({ user, accessToken }: ConsentGateProps) => {
  const router = useRouter();
  const [consentGiven, setConsentGiven] = useState(false);
  const [showPlaid, setShowPlaid] = useState(false);

  const handleConsentSubmit = () => {
    if (!consentGiven) return;
    setShowPlaid(true); // trigger plaid link
  };

  return (
    <div className="consent-gate border rounded-lg p-6 my-4 bg-yellow-50">
      <h3 className="text-lg font-semibold mb-2 text-yellow-900">
        Transactions Access Required
      </h3>
      <p className="text-sm text-yellow-800 mb-4">
        To view your recent transactions, you must allow Plaid to access the
        transactions product.
      </p>

      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={() => setConsentGiven(!consentGiven)}
        />
        <span className="text-sm text-yellow-800">
          I consent to allow access to transaction data.
        </span>
      </label>

      <button
        onClick={handleConsentSubmit}
        disabled={!consentGiven}
        className="px-4 py-2 text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-700 rounded disabled:opacity-50"
      >
        Submit
      </button>

      {showPlaid && (
        <div className="mt-4">
          <PlaidLink
            user={user}
            mode="update"
            accessToken={accessToken}
            variant="primary"
          />
        </div>
      )}
    </div>
  );
};

export default ConsentGate;
