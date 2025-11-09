"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Define the form validation schema with Zod
const applySchema = z.object({
  displayName: z.string().min(3, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().optional(),
  socialTwitter: z.string().optional(),
  socialLinkedin: z.string().optional(),
});

type ApplyFormInputs = z.infer<typeof applySchema>;

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const stayId = params.stayId as string;

  const { address, isConnected } = useAccount();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyFormInputs>({
    resolver: zodResolver(applySchema),
  });

  // Debug: Log the params to see what's available
  useEffect(() => {
    console.log("All params:", params);
    console.log("stayId from params:", stayId);
  }, [params, stayId]);

  const onSubmit: SubmitHandler<ApplyFormInputs> = async (data) => {
    if (!isConnected || !address) {
      setApiError("Please connect your wallet to apply.");
      return;
    }

    // Validate stayId before submitting
    if (!stayId || stayId === "undefined") {
      setApiError("A valid stay ID is missing from the URL. Please check the link.");
      console.error("Invalid stayId:", stayId);
      return;
    }

    setApiError(null);

    try {
      console.log("Submitting to:", `/api/stays/${stayId}/apply`);
      console.log("Data:", { ...data, walletAddress: address });

      const response = await fetch(`/api/stays/${stayId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          walletAddress: address,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      setIsSuccess(true);
      // ❌ Don't redirect - just show success message
    } catch (error: any) {
      console.error("Application error:", error);
      setApiError(error.message);
    }
  };

  // Show loading state while params are being resolved
  if (!stayId) {
    return (
      <div style={styles.container}>
        <p>Loading stay information...</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <h2>✅ Application Submitted!</h2>
          <p>
            Your application for <strong>{stayId}</strong> has been approved!
          </p>
          <p style={{ marginTop: "16px", color: "#666" }}>
            Redirecting to payment page in 2 seconds...
          </p>
          {paymentLink && (
            <a href={paymentLink} style={styles.paymentButton}>
              Proceed to Payment Now →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Apply for {stayId}</h2>
        <p style={styles.subtitle}>
          Please fill out the form below to apply for a spot. Your wallet will be
          used to verify your identity.
        </p>
      </div>

      {!isConnected ? (
        <div style={styles.connectWallet}>
          <div style={styles.connectCard}>
            <h3>Connect Your Wallet</h3>
            <p>Please connect your wallet to begin the application process.</p>
            <ConnectKitButton />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
          <div style={styles.formCard}>
            <div style={styles.field}>
              <label style={styles.label}>Wallet Address</label>
              <input
                type="text"
                value={address}
                readOnly
                disabled
                style={styles.inputDisabled}
              />
              <span style={styles.helpText}>
                ✓ Connected and verified
              </span>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Display Name <span style={styles.required}>*</span>
              </label>
              <input
                {...register("displayName")}
                style={styles.input}
                placeholder="Your name"
              />
              {errors.displayName && (
                <span style={styles.error}>{errors.displayName.message}</span>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Email Address <span style={styles.required}>*</span>
              </label>
              <input
                type="email"
                {...register("email")}
                style={styles.input}
                placeholder="your@email.com"
              />
              {errors.email && (
                <span style={styles.error}>{errors.email.message}</span>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Professional Role</label>
              <input
                {...register("role")}
                style={styles.input}
                placeholder="e.g., Founder, Developer, Designer"
              />
              <span style={styles.helpText}>
                Help us understand your background
              </span>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>X / Twitter Handle</label>
              <input
                {...register("socialTwitter")}
                style={styles.input}
                placeholder="https://x.com/yourusername"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>LinkedIn Profile</label>
              <input
                {...register("socialLinkedin")}
                style={styles.input}
                placeholder="https://linkedin.com/in/yourusername"
              />
            </div>

            {apiError && (
              <div style={styles.errorBox}>
                <strong>Error:</strong> {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...styles.button,
                ...(isSubmitting ? styles.buttonDisabled : {}),
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit Application & Proceed to Payment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// --- Styling ---
const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: "700px",
    margin: "40px auto",
    padding: "0 20px",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  } as const,
  subtitle: {
    color: "#666",
    fontSize: "1rem",
    marginTop: "10px",
  },
  connectWallet: {
    display: "flex",
    justifyContent: "center",
    padding: "40px 0",
  },
  connectCard: {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    textAlign: "center",
    maxWidth: "400px",
  } as const,
  form: {
    display: "flex",
    flexDirection: "column",
  } as const,
  formCard: {
    backgroundColor: "white",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "24px",
  } as const,
  label: {
    fontWeight: "600",
    marginBottom: "8px",
    color: "#333",
    fontSize: "0.95rem",
  },
  required: {
    color: "#ef4444",
  },
  input: {
    padding: "12px",
    fontSize: "1rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    transition: "border-color 0.2s",
  },
  inputDisabled: {
    padding: "12px",
    fontSize: "1rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    backgroundColor: "#f5f5f5",
    color: "#666",
  },
  helpText: {
    fontSize: "0.875rem",
    color: "#666",
    marginTop: "6px",
  },
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
    marginTop: "6px",
  },
  errorBox: {
    backgroundColor: "#fee",
    color: "#c00",
    padding: "12px",
    borderRadius: "6px",
    marginBottom: "20px",
    border: "1px solid #fcc",
  },
  button: {
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "600",
    backgroundColor: "#0070f3",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    cursor: "not-allowed",
  },
  successCard: {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    textAlign: "center",
  } as const,
  paymentButton: {
    display: "inline-block",
    marginTop: "20px",
    padding: "12px 24px",
    backgroundColor: "#10b981",
    color: "white",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: "600",
  },
} as const;