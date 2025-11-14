"use client";

import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useAccount, useSignMessage, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { GoogleIcon, WalletIcon } from "@/components/Icons";

// --- WaveDivider component (Unchanged) ---
const WaveDivider: React.FC<{
  colorClassName: string;
  inverted?: boolean;
}> = ({ colorClassName, inverted = false }) => (
  <div
    className={`w-full h-20 md:h-32 ${colorClassName}`}
    style={{
      maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23ffffff' fill-opacity='1' d='M0,160L48,181.3C96,203,192,245,288,261.3C384,277,480,267,576,234.7C672,203,768,149,864,138.7C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`,
      maskSize: "cover",
      maskRepeat: "no-repeat",
      transform: inverted ? "scaleY(-1)" : "none",
    }}
  />
);

// --- Tab type (Unchanged) ---
type Tab = "signup" | "login";

// --- MODIFIED: TabButton component (Style Rework) ---
const TabButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-1/2 py-3 px-4 font-semibold text-center transition-colors duration-200 ${
      isActive
        ? "bg-white text-[#172a46]" // ACTIVE: White BG, Dark Font
        : "bg-[#1f3a5a] text-gray-300 hover:bg-[#254261] hover:text-white" // INACTIVE: Dark BG, Light Font
    }`}
  >
    {label}
  </button>
);

// --- Info List Item component (Unchanged) ---
const InfoListItem: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <li className="flex items-start space-x-3">
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a4562] flex items-center justify-center mt-1">
      <svg
        className="w-4 h-4 text-[#E7E4DF]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          d="M5 13l4 4L19 7"
        ></path>
      </svg>
    </div>
    <span className="text-lg text-gray-300">{children}</span>
  </li>
);

// --- SignInForm component (Refactored) ---
function SignInForm() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("signup");

  const router = useRouter();
  const searchParams = useSearchParams();

  // Wagmi hooks
  const { connectAsync } = useConnect();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // --- Wallet & SIWE Logic (Unchanged) ---
  const handleWalletSignIn = async () => {
    setIsLoadingWallet(true);
    setError(null);
    try {
      // 1. Connect wallet
      if (!isConnected || !address) {
        await connectAsync({ connector: injected() });
      }

      // 2. Wait for account state to update
      let attempts = 0;
      const maxAttempts = 10;
      let currentAddress = address;
      let currentChainId = chainId;

      while ((!currentAddress || !currentChainId) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        currentAddress = (window as any).ethereum?.selectedAddress || address;
        currentChainId = (window as any).ethereum?.chainId
          ? parseInt((window as any).ethereum.chainId, 16)
          : chainId;
        attempts++;
      }

      currentAddress = currentAddress || address;
      currentChainId = currentChainId || chainId;

      if (!currentAddress || !currentChainId) {
        throw new Error("Wallet connection failed. Please try again.");
      }

      // 3. Fetch nonce (CSRF token)
      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("Failed to fetch nonce.");
      const { csrfToken } = await csrfRes.json();
      if (!csrfToken) throw new Error("Invalid nonce received.");

      // 4. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address: currentAddress,
        statement: "Sign in to DEDEN",
        uri: window.location.origin,
        version: "1",
        chainId: currentChainId,
        nonce: csrfToken,
      });

      const messageToSign = message.prepareMessage();

      // 5. Sign the message
      const signature = await signMessageAsync({ message: messageToSign });

      // 6. Sign in with NextAuth
      const res = await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        throw new Error(res.error);
      } else if (res?.ok) {
        router.push("/dashboard");
      } else {
        throw new Error("Unknown error during sign-in.");
      }
    } catch (e: any) {
      console.error("Wallet sign-in error:", e);
      if (
        e.message.includes("User rejected") ||
        e.message.includes("User denied")
      ) {
        setError("Sign-in request rejected.");
      } else if (
        e.message.includes("Wallet not found") ||
        e.message.includes("Account not found") ||
        e.message.includes("Wallet not registered") ||
        e.message.includes("CredentialsSignin")
      ) {
        setError(
          "This wallet isn't linked to an account. Please use the 'Sign Up' tab to create an account with Google first."
        );
        setActiveTab("signup");
      } else {
        setError(e.message || "Failed to sign in with wallet.");
      }
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // --- Google Sign-In Logic (Unchanged) ---
  const handleGoogleSignIn = () => {
    setIsLoadingGoogle(true);
    setError(null);
    signIn("google", { callbackUrl: "/dashboard" }).catch((e) => {
      console.error("Google sign-in error:", e);
      setError("Failed to sign in with Google.");
      setIsLoadingGoogle(false);
    });
  };

  // --- Handle NextAuth errors from URL (Unchanged) ---
  useEffect(() => {
    const authError = searchParams.get("error");
    if (authError) {
      if (authError === "OAuthAccountNotLinked") {
        setError(
          "This email is already linked to another account. Please sign in with your original method (e.g., wallet) and link Google from your profile."
        );
      } else {
        setError("An unknown authentication error occurred. Please try again.");
      }
      router.replace("/auth/signin", { scroll: false });
    }
  }, [searchParams, router]);

  // --- Dynamic content based on tab (Unchanged) ---
  const title = activeTab === "signup" ? "Create Account" : "Sign In";
  const subtitle =
    activeTab === "signup"
      ? "Create your DEDEN account to get started."
      : "Welcome back! Sign in to your account.";
  const googleButtonText =
    activeTab === "signup" ? "Sign up with Google" : "Sign in with Google";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E7E4DF] p-4 relative overflow-hidden w-full h-full">
      {/* Sign-In Card */}
      <div className="flex flex-col md:flex-row  w-full bg-[#172a46] rounded-2xl shadow-2xl p-8 z-10 md:w-8/12 md:-mt-60 md:justify-between md:items-center">
        {/* Logo */}
        <div>
          <h1 className="font-berlin text-5xl md:text-7xl font-bold text-center text-white mb-6">
            Sign In
          </h1>
          <p className="text-gray-300 mb-6 text-lg">{subtitle}</p>

          {/* --- MOVED: Error Message IS NOW HERE --- */}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg text-sm mb-6">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* --- Info List --- */}
          <ul className="space-y-5 mt-4">
            <InfoListItem>
              <strong className="text-white">Where Web3 lives</strong> and
              builders connect
            </InfoListItem>
            <InfoListItem>
              A <strong className="text-white">luxury villa experience</strong>{" "}
              curated for the biggest Web3 events.
            </InfoListItem>
            <InfoListItem>
              <strong className="font-inter text-white">Network.</strong>{" "}
              <strong className="font-inter text-white">Unwind.</strong>{" "}
              <strong className="font-inter text-white">Buidl IRL.</strong>
            </InfoListItem>
          </ul>
        </div>

        {/* --- MODIFIED: RIGHT COLUMN (Form & Actions) --- */}
        <div className="w-full md:w-1/2 p-8 md:p-12 bg-[#0f1e33] rounded-b-2xl md:rounded-2xl  flex flex-col justify-center">
          {/* --- REMOVED: Title, Subtitle, and Error (moved to left) --- */}

          {/* --- Tab Switcher --- */}
          <div className="flex rounded-lg overflow-hidden mb-6 border border-[#2a4562]">
            <TabButton
              label="Sign Up"
              isActive={activeTab === "signup"}
              onClick={() => {
                setError(null);
                setActiveTab("signup");
              }}
            />
            <TabButton
              label="Log In"
              isActive={activeTab === "login"}
              onClick={() => {
                setError(null);
                setActiveTab("login");
              }}
            />
          </div>

          {/* --- Conditional Content --- */}
          <div className="space-y-4">
            {/* Google Button (Text is dynamic) */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoadingGoogle || isLoadingWallet}
              className="w-full flex items-center justify-center gap-3 bg-white text-[#172a46] font-semibold py-3 px-5 rounded-xl shadow-lg transition-all hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingGoogle ? (
                <Spinner />
              ) : (
                <>
                  <GoogleIcon /> {googleButtonText}
                </>
              )}
            </button>

            {/* --- "Sign Up" Tab Content --- */}
            {activeTab === "signup" && (
              <p className="text-gray-400 text-sm text-center pt-2">
                New accounts must be created with Google. You can link your
                wallet from your profile settings after signing up.
              </p>
            )}

            {/* --- "Log In" Tab Content (Wallet Button) --- */}
            {activeTab === "login" && (
              <>
                {/* Divider */}
                <div className="flex items-center pt-2">
                  <div className="flex-grow border-t border-gray-600"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-sm">
                    OR
                  </span>
                  <div className="flex-grow border-t border-gray-600"></div>
                </div>

                {/* Wallet Button */}
                <button
                  onClick={handleWalletSignIn}
                  disabled={isLoadingWallet || isLoadingGoogle}
                  className="w-full flex items-center justify-center gap-3 bg-[#2a4562] text-white font-semibold py-3 px-5 rounded-xl shadow-lg transition-all hover:bg-[#3a5572] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingWallet ? (
                    <Spinner />
                  ) : (
                    <>
                      <WalletIcon /> Sign in with Wallet
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

// --- Default export with Suspense wrapper (Unchanged) ---
export default function SignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f3]">
          <div className="text-[#172a46] text-lg">Loading...</div>
        </div>
      }
    >
      <SignInForm />
    </React.Suspense>
  );
}

// --- Spinner component (Unchanged) ---
function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}
