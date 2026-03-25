"use client";
import React, { useState } from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export default function UpgradeModal({ isOpen, onClose, featureName = "AI Code Review" }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // userId auth contextdan olinadi (bu yerda mock qilingan)
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: "current-user-uuid", plan_type: "pro" })
      });
      const data = await response.json();
      
      if (data.url) {
        // Stripe to'lov sahifasiga yo'naltirish
        window.location.href = data.url; 
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all">
      <div className="bg-[#0f1117] border border-indigo-500/40 w-full max-w-md rounded-2xl shadow-[0_0_40px_rgba(99,102,241,0.15)] p-8 relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
          ✕
        </button>
        
        <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-3xl mb-6 shadow-lg shadow-indigo-500/30">
          🚀
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">Upgrade to Pro</h2>
        <p className="text-gray-400 mb-8 text-sm leading-relaxed">
          Unlock unlimited <span className="text-indigo-400 font-semibold">{featureName}</span>, personalized learning paths, and premium test cases. 
          Take your competitive programming skills to the next level.
        </p>

        <button 
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg transition shadow-lg disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
          {isLoading ? "Redirecting..." : "Try Pro Free for 7 Days"}
        </button>
        <div className="mt-4 text-xs text-gray-500">Cancel anytime. No commitment.</div>
      </div>
    </div>
  );
}