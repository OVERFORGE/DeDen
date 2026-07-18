// components/admin/StayChainConfig.tsx

"use client";

import { useState } from 'react';
import { chainConfig, SUPPORTED_CHAINS, getChainName } from '@/lib/config';

interface StayChainConfigProps {
  stayId: string;
  currentEnabledChains: number[];
  onUpdate: () => void;
}

export function StayChainConfig({ stayId, currentEnabledChains, onUpdate }: StayChainConfigProps) {
  const [enabledChains, setEnabledChains] = useState<number[]>(currentEnabledChains);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleChain = (chainId: number) => {
    if (enabledChains.includes(chainId)) {
      setEnabledChains(enabledChains.filter(id => id !== chainId));
    } else {
      setEnabledChains([...enabledChains, chainId]);
    }
  };

  const handleSave = async () => {
    if (enabledChains.length === 0) {
      setError('Please select at least one chain');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/stays/${stayId}/chains`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledChains }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update chains');
      }

      alert('✅ Enabled chains updated successfully!');
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        💳 Payment Networks
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Select which blockchain networks guests can use to pay for this stay
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {SUPPORTED_CHAINS.map((chainId) => {
          const chain = chainConfig[chainId];
          const isEnabled = enabledChains.includes(chainId);
          const supportedTokens = Object.keys(chain.tokens);

          return (
            <div
              key={chainId}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                isEnabled
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => toggleChain(chainId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleChain(chainId)}
                      className="w-5 h-5 text-blue-600 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="font-semibold text-gray-900">
                      {chain.name}
                    </span>
                    {chain.testnet && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                        TESTNET
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 ml-7">
                    Supported tokens: {supportedTokens.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || enabledChains.length === 0}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : 'Save Chain Configuration'}
      </button>

      {enabledChains.length === 0 && (
        <p className="text-sm text-red-600 text-center mt-2">
          ⚠️ At least one chain must be selected
        </p>
      )}
    </div>
  );
}