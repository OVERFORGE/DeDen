"use client";

import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useAccount, useSignMessage, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleIcon, WalletIcon } from "@/components/Icons";
import { AlertCircle, ArrowRight, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

const HIGHLIGHTS = [
  "Curated luxury villa stays at major Web3 conferences",
  "Seamless crypto payments & instant NFT event tickets",
  "Network, collaborate & build IRL with leading founders",
];

type Tab = "signup" | "login";

function SignInForm() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("signup");

  const router = useRouter();
  const searchParams = useSearchParams();

  const { connectAsync } = useConnect();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // ── Wallet / SIWE sign-in (logic unchanged) ───────────────────────────────

  const handleWalletSignIn = async () => {
    setIsLoadingWallet(true);
    setError(null);
    try {
      if (!isConnected || !address) {
        await connectAsync({ connector: injected() });
      }
      let attempts = 0;
      let currentAddress = address;
      let currentChainId = chainId;
      while ((!currentAddress || !currentChainId) && attempts < 10) {
        await new Promise((r) => setTimeout(r, 100));
        currentAddress = (window as any).ethereum?.selectedAddress || address;
        currentChainId = (window as any).ethereum?.chainId
          ? parseInt((window as any).ethereum.chainId, 16)
          : chainId;
        attempts++;
      }
      currentAddress = currentAddress || address;
      currentChainId = currentChainId || chainId;
      if (!currentAddress || !currentChainId) throw new Error("Wallet connection failed. Please try again.");

      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("Failed to fetch nonce.");
      const { csrfToken } = await csrfRes.json();
      if (!csrfToken) throw new Error("Invalid nonce received.");

      const message = new SiweMessage({
        domain: window.location.host,
        address: currentAddress,
        statement: "Sign in to DEDEN",
        uri: window.location.origin,
        version: "1",
        chainId: currentChainId,
        nonce: csrfToken,
      });
      const signature = await signMessageAsync({ message: message.prepareMessage() });
      const res = await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (res?.error) throw new Error(res.error);
      else if (res?.ok) router.push("/dashboard");
      else throw new Error("Unknown error during sign-in.");
    } catch (e: any) {
      if (e.message.includes("User rejected") || e.message.includes("User denied")) {
        setError("Sign-in request rejected.");
      } else if (
        e.message.includes("Wallet not found") ||
        e.message.includes("Account not found") ||
        e.message.includes("Wallet not registered") ||
        e.message.includes("CredentialsSignin")
      ) {
        setError("This wallet isn't linked to an account yet. Create an account with Google first, then link your wallet from your profile.");
        setActiveTab("signup");
      } else {
        setError(e.message || "Failed to sign in with wallet.");
      }
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // ── Google sign-in (logic unchanged) ─────────────────────────────────────

  const handleGoogleSignIn = () => {
    setIsLoadingGoogle(true);
    setError(null);
    signIn("google", { callbackUrl: "/dashboard" }).catch(() => {
      setError("Failed to sign in with Google.");
      setIsLoadingGoogle(false);
    });
  };

  // ── URL error handler (logic unchanged) ───────────────────────────────────

  useEffect(() => {
    const authError = searchParams.get("error");
    if (authError) {
      if (authError === "OAuthAccountNotLinked") {
        setError("This email is already linked to another account. Please sign in with your original method and link Google from your profile.");
      } else {
        setError("An authentication error occurred. Please try again.");
      }
      router.replace("/auth/signin", { scroll: false });
    }
  }, [searchParams, router]);

  const isSignUp = activeTab === "signup";

  return (
    <div className="min-h-screen bg-[#f7eedb] flex items-center justify-center p-4 sm:p-8">
      {/* Container Card */}
      <div className="w-full max-w-4xl bg-[#9db47d] border-4 border-[#2c331f] rounded-2xl shadow-[8px_8px_0px_0px_#2c331f] flex flex-col md:flex-row overflow-hidden my-auto">

        {/* ── Left Side: Brand & Highlights ────────────────────────────────── */}
        <div className="w-full md:w-5/12 p-8 md:p-10 bg-[#9db47d] text-[#2c331f] flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#2c331f] text-[#f7eedb] rounded-md text-[10px] font-black uppercase tracking-widest mb-6">
              <Sparkles size={11} className="text-[#9db47d]" /> Web3 Community
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight uppercase leading-tight mb-3">
              Where Web3 Lives IRL
            </h1>
            <p className="text-xs font-bold text-[#2c331f]/80 leading-relaxed mb-8 uppercase tracking-wider">
              Luxury villa retreats &amp; popups for builders &amp; creators.
            </p>

            {/* Highlights */}
            <div className="space-y-4 border-t-2 border-[#2c331f]/20 pt-6">
              {HIGHLIGHTS.map((text, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-md bg-[#2c331f] text-[#f7eedb] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </div>
                  <p className="text-xs font-bold text-[#2c331f] leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 mt-6 border-t-2 border-[#2c331f]/20">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-black text-[#2c331f] hover:underline uppercase tracking-widest"
            >
              <ArrowLeft size={14} strokeWidth={3} /> Return to Home
            </Link>
          </div>
        </div>

        {/* ── Right Side: Form & Actions ───────────────────────────────────── */}
        <div className="w-full md:w-7/12 p-8 md:p-10 bg-white border-t-4 md:border-t-0 md:border-l-4 border-[#2c331f] flex flex-col justify-center">

          {/* Tab Switcher */}
          <div className="flex rounded-xl overflow-hidden mb-6 border-2 border-[#2c331f]">
            <button
              onClick={() => { setActiveTab("signup"); setError(null); }}
              className={`flex-1 py-3 font-black uppercase tracking-widest text-xs transition-all ${
                activeTab === "signup"
                  ? "bg-[#2c331f] text-[#f7eedb]"
                  : "bg-white text-[#5a6b3a] hover:bg-[#f7eedb]"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setActiveTab("login"); setError(null); }}
              className={`flex-1 py-3 font-black uppercase tracking-widest text-xs transition-all ${
                activeTab === "login"
                  ? "bg-[#2c331f] text-[#f7eedb]"
                  : "bg-white text-[#5a6b3a] hover:bg-[#f7eedb]"
              }`}
            >
              Sign In
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-50 border-2 border-red-500 text-red-800 px-4 py-3 rounded-xl font-bold text-xs shadow-[2px_2px_0px_0px_#dc2626]">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoadingGoogle || isLoadingWallet}
              className="w-full flex items-center justify-center gap-3 bg-[#f7eedb] text-[#2c331f] font-black uppercase tracking-widest text-xs py-3.5 px-5 rounded-xl shadow-[4px_4px_0px_0px_#2c331f] border-2 border-[#2c331f] transition-all hover:shadow-none hover:translate-y-1 hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingGoogle ? (
                <Spinner />
              ) : (
                <>
                  <GoogleIcon />
                  <span>{isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
                </>
              )}
            </button>

            {isSignUp && (
              <p className="text-[#5a6b3a] font-bold text-[11px] uppercase tracking-widest text-center px-2 pt-1 leading-relaxed">
                New accounts start with Google. You can link your Web3 wallet anytime from your dashboard.
              </p>
            )}

            {!isSignUp && (
              <>
                <div className="flex items-center my-2">
                  <div className="flex-grow border-t-2 border-[#2c331f]"></div>
                  <span className="flex-shrink mx-4 text-[#2c331f] font-black uppercase tracking-widest text-xs">
                    OR
                  </span>
                  <div className="flex-grow border-t-2 border-[#2c331f]"></div>
                </div>

                <button
                  onClick={handleWalletSignIn}
                  disabled={isLoadingWallet || isLoadingGoogle}
                  className="w-full flex items-center justify-center gap-3 bg-[#2c331f] text-[#f7eedb] font-black uppercase tracking-widest text-xs py-3.5 px-5 rounded-xl shadow-[4px_4px_0px_0px_#9db47d] border-2 border-[#2c331f] transition-all hover:shadow-none hover:translate-y-1 hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingWallet ? (
                    <Spinner />
                  ) : (
                    <>
                      <WalletIcon />
                      <span>Sign in with Wallet</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Default export with Suspense wrapper ──────────────────────────────────────

export default function SignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f7eedb]">
          <div className="w-10 h-10 border-4 border-[#2c331f]/20 border-t-[#2c331f] rounded-full animate-spin"></div>
        </div>
      }
    >
      <SignInForm />
    </React.Suspense>
  );
}
