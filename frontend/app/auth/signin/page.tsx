// app/auth/signin/page.tsx
"use client";

// NEW: Import React and Suspense
import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useAccount, useSignMessage, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { SiweMessage } from "siwe";
// NEW: Import useSearchParams
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { GoogleIcon, WalletIcon } from "@/components/Icons";

// --- WaveDivider component (unchanged) ---
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
// ---------------------------------

// NEW: Create a child component for the sign-in logic
function SignInForm() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams(); // <-- Get search params

  // --- Wallet & SIWE Logic (Unchanged) ---
  const { connectAsync } = useConnect();
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const handleWalletSignIn = async () => {
    setIsLoadingWallet(true);
    setError(null);
    try {
      // 1. Connect wallet
      let currentAddress = address;
      let currentChainId = chainId;

      if (!currentAddress) {
        const { address: connectedAddress, chainId: connectedChainId } =
          await connectAsync({ connector: injected() });
        currentAddress = connectedAddress;
        currentChainId = connectedChainId;
      }

      if (!currentAddress || !currentChainId) {
        throw new Error("Wallet connection failed.");
      }

      // 2. Fetch nonce
      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) throw new Error("Failed to fetch nonce.");
      const { csrfToken } = await csrfRes.json();
      if (!csrfToken) throw new Error("Invalid nonce received.");

      // 3. Create SIWE message
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

      // 4. Sign the message
      const signature = await signMessageAsync({ message: messageToSign });

      // 5. Sign in
      const res = await signIn("credentials", {
        message: JSON.stringify(message),
        signature,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        throw new Error(res.error);
      } else if (res?.ok) {
        router.push(res.callbackUrl || "/dashboard");
      } else {
        throw new Error("Unknown error during sign-in.");
      }
    } catch (e: any) {
      console.error("Wallet sign-in error:", e);
      // NEW: Show a friendlier wallet error
      if (e.message.includes("User rejected")) {
        setError("Sign-in request rejected.");
      } else {
         setError(e.message || "Failed to sign in with wallet.");
      }
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // --- Google Logic (Unchanged) ---
  const handleGoogleSignIn = () => {
    setIsLoadingGoogle(true);
    setError(null);
    signIn("google", { callbackUrl: "/dashboard" }).catch((e) => {
      console.error("Google sign-in error:", e);
      setError("Failed to sign in with Google.");
      setIsLoadingGoogle(false);
    });
  };

  // --- NEW: Handle NextAuth errors from URL ---
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
      // Clear the error from the URL
      router.replace("/auth/signin", { scroll: false });
    }
  }, [searchParams, router]);

  return (
    // Page background
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f3] p-4 relative overflow-hidden">
      {/* Sign-In Card */}
      <div className="max-w-md w-full bg-[#172a46] rounded-2xl shadow-2xl p-8 z-10">
        
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <Image
              src="/images/logo-no-bg.png"
              alt="DEDEN Logo"
              width={140}
              height={50}
              className="h-12 w-auto"
            />
          </Link>
        </div>

        {/* Heading */}
        <h1
          className="text-5xl font-bold text-center text-white mb-6"
          style={{
            fontFamily: "'New Rocker', cursive",
            letterSpacing: "-0.07em",
          }}
        >
          Sign In
        </h1>

        <p className="text-center text-gray-300 mb-8">
          Choose your preferred method to log in.
        </p>

        {/* Error message (This will now show the OAuth error!) */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Google Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle || isLoadingWallet}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#172a46] font-semibold py-3 px-5 rounded-full shadow-lg transition-all hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingGoogle ? <Spinner /> : <><GoogleIcon /> Sign in with Google</>}
          </button>

          {/* Wallet Button */}
          <button
            onClick={handleWalletSignIn}
            disabled={isLoadingWallet || isLoadingGoogle}
            className="w-full flex items-center justify-center gap-3 bg-[#2a4562] text-white font-semibold py-3 px-5 rounded-full shadow-lg transition-all hover:bg-[#3a5572] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingWallet ? <Spinner /> : <><WalletIcon /> Sign in with Wallet</>}
          </button>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <WaveDivider colorClassName="bg-[#172a46]" />
      </div>
    </div>
  );
}

// --- NEW: Default export that wraps the form in Suspense ---
export default function SignInPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </React.Suspense>
  );
}


// --- Spinner component (unchanged) ---
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