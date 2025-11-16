// app/stay/[stayId]/apply/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  Mail,
  User,
  Briefcase,
  Twitter,
  Linkedin,
  Wallet,
  AlertCircle,
  LogIn,
  Phone,
  Users as UsersIcon,
  DollarSign,
  Calendar,
} from "lucide-react";
import useFormPersistence from "@/lib/hooks/useFormPersistence"; // adjust path if needed

/* --------------------- validation schema --------------------- */
const applySchema = z
  .object({
    displayName: z.string().min(3, "Name is required"),
    email: z.string().email("Invalid email address"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),

    gender: z.enum(["Male", "Female", "Other", "Prefer not to say"], {
      message: "Please select your gender",
    }),
    age: z
      .number()
      .min(18, "You must be at least 18 years old")
      .max(120, "Invalid age"),
    mobileNumber: z.string().min(10, "Valid mobile number is required"),

    selectedRoomId: z.string().optional(),
    selectedCurrency: z.string().optional(),

    checkInDate: z.string().min(1, "Please select check-in date"),
    checkOutDate: z.string().min(1, "Please select check-out date"),

    role: z.string().optional(),
    socialTwitter: z.string().optional(),
    socialLinkedin: z.string().optional(),
    socialTelegram: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.selectedRoomId && data.selectedRoomId !== "") {
        return ["USDC", "USDT"].includes(data.selectedCurrency as string);
      }
      return true;
    },
    {
      message:
        "Please select a payment currency (USDC or USDT) for your preferred room.",
      path: ["selectedCurrency"],
    }
  )
  .refine(
    (data) => {
      if (data.checkInDate && data.checkOutDate) {
        return new Date(data.checkOutDate) > new Date(data.checkInDate);
      }
      return true;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOutDate"],
    }
  );

type ApplyFormInputs = z.infer<typeof applySchema>;

type StayData = {
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  duration: number;
  priceUSDC: number;
  priceUSDT: number;
  rooms: any[];
};

/* --------------------- date helpers --------------------- */
const formatDateForInput = (date: Date | string | null | undefined): string => {
  try {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (err) {
    console.error("[formatDateForInput] error", err);
    return "";
  }
};

const formatDateForDisplay = (
  date: Date | string | null | undefined
): string => {
  try {
    if (!date) return "Loading...";
    const d = typeof date === "string" ? new Date(date) : date;
    if (!(d instanceof Date) || isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (err) {
    console.error("[formatDateForDisplay] error", err);
    return "Invalid Date";
  }
};

const calculateNightsBetween = (
  checkIn: string | Date | null | undefined,
  checkOut: string | Date | null | undefined
): number => {
  try {
    if (!checkIn || !checkOut) return 0;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (
      isNaN(checkInDate.getTime()) ||
      isNaN(checkOutDate.getTime()) ||
      checkOutDate <= checkInDate
    ) {
      return 0;
    }
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (err) {
    console.error("[calculateNightsBetween] error", err);
    return 0;
  }
};

/* --------------------- page component --------------------- */
export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const stayId = params.stayId as string;

  const { data: session, status: sessionStatus } = useSession();
  const { address, isConnected } = useAccount();

  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [stayData, setStayData] = useState<StayData | null>(null);
  const [calculatedNights, setCalculatedNights] = useState<number>(0);
  const [stayDuration, setStayDuration] = useState<number>(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [isSuccess]);

  // react-hook-form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<ApplyFormInputs>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      selectedRoomId: "",
      selectedCurrency: "",
      checkInDate: "",
      checkOutDate: "",
    },
  });

  const currentSelectedRoomId = watch("selectedRoomId");
  const currentSelectedCurrency = watch("selectedCurrency");
  const checkInDate = watch("checkInDate");
  const checkOutDate = watch("checkOutDate");

  // Persist form - key includes stayId + user email (or anon)
  const persistenceKey = `apply:${stayId}:${
    (session?.user as any)?.email ?? "anon"
  }`;
  const { clear: clearPersistence } = useFormPersistence(
    persistenceKey,
    {
      watch,
      reset,
      handleSubmit: (fn: any) => (e?: unknown) => fn(e),
    } as any /* cast because useFormPersistence expects UseFormReturn; we pass minimal shape */,
    {
      debounceMs: 300,
      restore: true,
    }
  );

  // keep nights updated when dates change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      setCalculatedNights(calculateNightsBetween(checkInDate, checkOutDate));
    } else if (stayData) {
      setCalculatedNights(0);
    }
  }, [checkInDate, checkOutDate, stayData]);

  // fetch stay and prefill
  useEffect(() => {
    const fetchStayData = async () => {
      try {
        const res = await fetch(`/api/stays/${stayId}`);
        if (!res.ok) {
          console.error("Failed to fetch stay", await res.text());
          return;
        }
        const data = await res.json();
        setStayData(data);

        // compute stay duration
        let duration = 0;
        if (data.duration && !isNaN(data.duration)) {
          duration = Number(data.duration);
        } else if (data.startDate && data.endDate) {
          duration = calculateNightsBetween(data.startDate, data.endDate);
        }
        setStayDuration(duration);

        // prefill dates if not present in storage (we restore via hook)
        // But reset explicit default from stay only if form has no values:
        const currentCheckIn = formatDateForInput(data.startDate);
        const currentCheckOut = formatDateForInput(data.endDate);

        // If the form already has values (due to persistence) we don't overwrite.
        const rawSaved = (() => {
          try {
            return localStorage.getItem(persistenceKey);
          } catch {
            return null;
          }
        })();

        if (!rawSaved) {
          setValue("checkInDate", currentCheckIn);
          setValue("checkOutDate", currentCheckOut);
        }
      } catch (err) {
        console.error("Error fetching stay data:", err);
      }
    };

    if (stayId && stayId !== "undefined") fetchStayData();
  }, [stayId, setValue, persistenceKey]);

  // prefill user fields when session loads (but don't overwrite persisted values)
  useEffect(() => {
    if (!session?.user) return;

    // check if persisted data exists
    let persisted = null;
    try {
      persisted = localStorage.getItem(persistenceKey);
    } catch {
      persisted = null;
    }

    if (!persisted) {
      const sessionUser = session.user as any;
      reset({
        displayName: sessionUser.name || "",
        email: sessionUser.email || "",
        firstName: sessionUser.firstName || "",
        lastName: sessionUser.lastName || "",
        role: sessionUser.role || "",
        gender:
          applySchema.shape.gender.safeParse(sessionUser.gender).success &&
          sessionUser.gender
            ? sessionUser.gender
            : undefined,
        age:
          !isNaN(parseFloat(sessionUser.age)) && isFinite(sessionUser.age)
            ? Number(sessionUser.age)
            : undefined,
        mobileNumber: sessionUser.mobileNumber || "",
        socialTwitter: sessionUser.socialTwitter || "",
        socialLinkedin: sessionUser.socialLinkedin || "",
        socialTelegram: sessionUser.socialTelegram || "",
        selectedRoomId: "",
        selectedCurrency: "",
        checkInDate: stayData ? formatDateForInput(stayData.startDate) : "",
        checkOutDate: stayData ? formatDateForInput(stayData.endDate) : "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, stayData]);

  const handleRoomSelection = (
    roomId: string,
    currency: "USDC" | "USDT" | null
  ) => {
    if (!roomId) {
      setValue("selectedRoomId", "");
      setValue("selectedCurrency", "");
    } else {
      setValue("selectedRoomId", roomId);
      setValue("selectedCurrency", currency || "", { shouldValidate: true });
    }
  };

  const calculateTotalPrice = (pricePerNight: number | undefined | null) => {
    const price = Number(pricePerNight) || 0;
    const nights = calculatedNights || 0;
    const total = price * nights;
    return isNaN(total) || total === 0 ? "0.00" : total.toFixed(2);
  };

  const onSubmit: SubmitHandler<ApplyFormInputs> = async (data) => {
    if (sessionStatus !== "authenticated") {
      setApiError("Please sign in to apply for this stay.");
      return;
    }

    if (!isConnected || !address) {
      setApiError(
        "Please connect your wallet to complete your application. This is required for payment processing."
      );
      return;
    }

    if (!stayId || stayId === "undefined") {
      setApiError("Invalid stay ID. Please check the URL and try again.");
      return;
    }

    if (calculatedNights <= 0) {
      setApiError("Please select valid check-in and check-out dates.");
      return;
    }

    setApiError(null);

    try {
      const response = await fetch(`/api/stays/${stayId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          walletAddress: address,
          selectedCurrency: data.selectedRoomId ? data.selectedCurrency : null,
          numberOfNights: calculatedNights,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            "You have already applied for this stay. Check your dashboard for status."
          );
        }
        throw new Error(result.error || "Failed to submit application");
      }

      // clear persisted form and show success
      try {
        clearPersistence();
      } catch (err) {
        console.warn("Failed to clear persistence", err);
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error("Application error:", error);
      setApiError(error.message);
    }
  };

  /* ---------- Render states ---------- */
  if (!stayId) {
    return (
      <div className="min-h-screen bg-[#f5f5f3] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#172a46] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading stay information...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#E7E4DF]">
        <section className="bg-[#172a46] pt-20 pb-32 relative">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="bg-white rounded-3xl p-12 md:p-16 shadow-2xl">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="text-green-600" size={48} strokeWidth={3} />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#172a46] mb-4">
                Application Submitted!
              </h1>
              <p className="text-xl text-gray-600 mb-3">
                Your application for{" "}
                <strong className="text-[#172a46]">
                  {stayData?.title || stayId}
                </strong>{" "}
                is now <strong>under review</strong>.
              </p>
              {watch("checkInDate") && watch("checkOutDate") && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 inline-block">
                  <p className="text-sm text-gray-600 mb-1">
                    Your selected dates:
                  </p>
                  <p className="font-semibold text-gray-800">
                    📅 {new Date(watch("checkInDate")).toLocaleDateString()} -{" "}
                    {new Date(watch("checkOutDate")).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    <strong>
                      {calculatedNights} night
                      {calculatedNights !== 1 ? "s" : ""}
                    </strong>
                  </p>
                </div>
              )}
              <p className="text-gray-500 mb-8">
                We'll notify you via email and update your dashboard once it's
                approved. This typically takes 24-48 hours.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/dashboard"
                  className="bg-[#172a46] text-white text-lg font-semibold py-4 px-8 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-xl"
                >
                  <span>View My Dashboard</span>
                  <ArrowRight size={20} />
                </Link>
                <Link
                  href={`/stay/${stayId}`}
                  className="bg-gray-100 text-[#172a46] text-lg font-semibold py-4 px-8 rounded-full inline-flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors"
                >
                  <span>Back to Stay Details</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E7E4DF]">
      {/* Hero */}
      <section className="bg-[#172a46] pt-0 pb-32 relative">
        <div className=" mx-auto px-6 pt-12 md:px-38 ">
          <div className="text-gray-300 text-sm mb-8">
            <span className="hover:text-white cursor-pointer">Home</span>
            <span className="mx-2">/</span>
            <span className="hover:text-white cursor-pointer">Stays</span>
            <span className="mx-2">/</span>
            <span className="hover:text-white cursor-pointer">{stayId}</span>
            <span className="mx-2">/</span>
            <span className="text-white">Apply</span>
          </div>

          <div className="text-center text-white mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Apply for {stayData?.title || stayId}
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Complete your application below. You need to be signed in and have
              a wallet connected for payment processing.
            </p>
            {stayData && (
              <div className="mt-4 space-y-2">
                <p className="text-md text-gray-400">
                  📅 Available:{" "}
                  {new Date(stayData.startDate).toLocaleDateString()} -{" "}
                  {new Date(stayData.endDate).toLocaleDateString()}
                </p>
                {stayDuration > 0 && (
                  <p className="text-sm text-gray-500">
                    Duration:{" "}
                    <strong className="text-gray-300">
                      {stayDuration} nights
                    </strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="bg-[#172a46] md:px-80 mx-auto px-6 -mt-20 relative z-10 pb-20">
        {sessionStatus === "unauthenticated" && (
          <div className="bg-white rounded-3xl p-12 shadow-2xl text-center">
            <div className="w-20 h-20 bg-[#172a46] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <LogIn className="text-white" size={36} />
            </div>
            <h2 className="text-3xl font-bold text-[#172a46] mb-4">
              Sign In Required
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Please sign in with your wallet or Gmail to begin the application
              process.
            </p>
            <Link
              href="/auth/signin"
              className="bg-[#172a46] text-white text-lg font-semibold py-4 px-8 rounded-full inline-flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-xl"
            >
              <span>Sign In</span>
              <ArrowRight size={20} />
            </Link>
          </div>
        )}

        {sessionStatus === "loading" && (
          <div className="bg-white rounded-3xl p-12 shadow-2xl text-center">
            <div className="w-16 h-16 border-4 border-[#172a46] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Verifying authentication...</p>
          </div>
        )}

        {sessionStatus === "authenticated" && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200 p-6">
              <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                <Check className="text-green-600" size={20} />
                <span className="font-semibold text-green-800">
                  Signed in as: {session.user?.email}
                </span>
              </div>

              {isConnected && address ? (
                <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-700">
                    Wallet: {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className="text-yellow-600 flex-shrink-0 mt-0.5"
                      size={20}
                    />
                    <div>
                      <p className="font-semibold text-yellow-800 mb-2">
                        Wallet Not Connected
                      </p>
                      <p className="text-yellow-700 text-sm mb-3">
                        Connect your wallet to complete the application.
                      </p>
                      <ConnectKitButton />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="p-8 md:p-12 space-y-8"
            >
              {/* Date range & timeline */}
              {stayData && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-2">
                    <Calendar size={20} />
                    Select Your Stay Dates{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="bg-white border-2 border-[#172a46] rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-600">
                        Event Period:
                      </div>
                      {stayDuration > 0 && (
                        <div className="bg-[#172a46] text-white px-3 py-1 rounded-full text-xs font-bold">
                          {stayDuration} Nights Total
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-center">
                        <div className="text-xs text-gray-500 mb-1">
                          Check-in Available
                        </div>
                        <div className="font-bold text-[#172a46]">
                          {stayData.startDate
                            ? formatDateForDisplay(stayData.startDate)
                            : "Loading..."}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-16 h-0.5 bg-[#172a46]"></div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-xs text-gray-500 mb-1">
                          Check-out By
                        </div>
                        <div className="font-bold text-[#172a46]">
                          {stayData.endDate
                            ? formatDateForDisplay(stayData.endDate)
                            : "Loading..."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 text-center italic">
                    📅 Choose any check-in and check-out dates within this
                    period
                  </p>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Check-In Date
                      </label>
                      <input
                        type="date"
                        {...register("checkInDate")}
                        min={
                          stayData.startDate
                            ? formatDateForInput(stayData.startDate)
                            : undefined
                        }
                        max={
                          stayData.endDate
                            ? formatDateForInput(stayData.endDate)
                            : undefined
                        }
                        className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-[#172a46] focus:outline-none transition-colors"
                      />
                      {errors.checkInDate && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          {errors.checkInDate.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Check-Out Date
                      </label>
                      <input
                        type="date"
                        {...register("checkOutDate")}
                        min={
                          checkInDate ||
                          (stayData.startDate
                            ? formatDateForInput(stayData.startDate)
                            : undefined)
                        }
                        max={
                          stayData.endDate
                            ? formatDateForInput(stayData.endDate)
                            : undefined
                        }
                        className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-[#172a46] focus:outline-none transition-colors"
                      />
                      {errors.checkOutDate && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          {errors.checkOutDate.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Selection summary */}
                  {calculatedNights > 0 ? (
                    <div className="bg-white border-2 border-green-400 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="text-green-600" size={20} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">
                              Your Selection
                            </div>
                            <div className="font-bold text-[#172a46] text-lg">
                              {calculatedNights} Night
                              {calculatedNights !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">
                            Dates
                          </div>
                          <div className="text-sm font-semibold text-[#172a46]">
                            {checkInDate && checkOutDate ? (
                              <>
                                {new Date(checkInDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )}{" "}
                                -{" "}
                                {new Date(checkOutDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )}
                              </>
                            ) : (
                              "Select dates"
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-sm text-gray-500">
                        👆 Select your dates above to see your booking duration
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Display Name, Email */}
              <div>
                <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                  <User size={20} />
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("displayName")}
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                />
                {errors.displayName && (
                  <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.displayName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                  <Mail size={20} />
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="your@email.com"
                  className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.email.message}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-2 ml-1">
                  We'll send your application status and updates here
                </p>
              </div>

              {/* Gender */}
              <div>
                <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("gender")}
                  className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.gender && (
                  <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.gender.message}
                  </p>
                )}
              </div>

              {/* Age & Mobile */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("age", { valueAsNumber: true })}
                    type="number"
                    min="18"
                    max="120"
                    placeholder="e.g., 25"
                    className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                  />
                  {errors.age && (
                    <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.age.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                    <Phone size={20} />
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("mobileNumber")}
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                  />
                  {errors.mobileNumber && (
                    <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.mobileNumber.message}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-2 ml-1">
                    Include country code (e.g., +91 for India)
                  </p>
                </div>
              </div>

              {/* Room selection */}
              {stayData &&
                stayData.rooms &&
                stayData.rooms.length > 0 &&
                calculatedNights > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                      <UsersIcon size={20} />
                      Preferred Room & Currency (Optional)
                    </label>
                    <div className="space-y-4">
                      {stayData.rooms.map((room: any) => (
                        <div
                          key={room.id}
                          className={`border-2 rounded-2xl p-5 transition-all ${
                            currentSelectedRoomId === room.id
                              ? "border-[#172a46] bg-blue-50 shadow-md"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-[#172a46] text-lg">
                              {room.name}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {room.description}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                            <UsersIcon size={16} />
                            <span>Capacity: {room.capacity}</span>
                          </div>

                          <div className="mt-4 border-t border-gray-200 pt-3">
                            <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1">
                              <DollarSign size={16} /> Select Payment Currency:
                            </p>
                            <div className="flex gap-4">
                              <label
                                className={`flex-1 border-2 rounded-xl cursor-pointer transition-all ${
                                  currentSelectedRoomId === room.id &&
                                  currentSelectedCurrency === "USDC"
                                    ? "border-green-600 bg-green-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                                onClick={() =>
                                  handleRoomSelection(room.id, "USDC")
                                }
                              >
                                <div className="p-3">
                                  <input
                                    type="radio"
                                    name={`room_currency_${room.id}`}
                                    className="sr-only"
                                    checked={
                                      currentSelectedRoomId === room.id &&
                                      currentSelectedCurrency === "USDC"
                                    }
                                    readOnly
                                  />
                                  <div className="text-center">
                                    <div className="font-bold text-sm text-green-700 mb-1">
                                      ${room.priceUSDC || 0}/night
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Total:{" "}
                                      <strong className="text-green-700">
                                        ${calculateTotalPrice(room.priceUSDC)}{" "}
                                        USDC
                                      </strong>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {calculatedNights} night
                                      {calculatedNights !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                </div>
                              </label>

                              <label
                                className={`flex-1 border-2 rounded-xl cursor-pointer transition-all ${
                                  currentSelectedRoomId === room.id &&
                                  currentSelectedCurrency === "USDT"
                                    ? "border-purple-600 bg-purple-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                                onClick={() =>
                                  handleRoomSelection(room.id, "USDT")
                                }
                              >
                                <div className="p-3">
                                  <input
                                    type="radio"
                                    name={`room_currency_${room.id}`}
                                    className="sr-only"
                                    checked={
                                      currentSelectedRoomId === room.id &&
                                      currentSelectedCurrency === "USDT"
                                    }
                                    readOnly
                                  />
                                  <div className="text-center">
                                    <div className="font-bold text-sm text-purple-700 mb-1">
                                      ${room.priceUSDT || 0}/night
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Total:{" "}
                                      <strong className="text-purple-700">
                                        ${calculateTotalPrice(room.priceUSDT)}{" "}
                                        USDT
                                      </strong>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {calculatedNights} night
                                      {calculatedNights !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {currentSelectedRoomId &&
                      currentSelectedRoomId !== "" &&
                      errors.selectedCurrency && (
                        <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          {errors.selectedCurrency.message}
                        </p>
                      )}
                  </div>
                )}

              {/* name fields */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                    First Name
                  </label>
                  <input
                    {...register("firstName")}
                    type="text"
                    placeholder="First name"
                    className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                    Last Name
                  </label>
                  <input
                    {...register("lastName")}
                    type="text"
                    placeholder="Last name"
                    className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* professional role */}
              <div>
                <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                  <Briefcase size={20} />
                  Professional Role
                </label>
                <input
                  {...register("role")}
                  type="text"
                  placeholder="e.g., Founder, Developer, Designer, Investor"
                  className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                />
              </div>

              {/* socials */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                    <Twitter size={20} />X / Twitter
                  </label>
                  <input
                    {...register("socialTwitter")}
                    type="text"
                    placeholder="@yourusername"
                    className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-3">
                    <Linkedin size={20} />
                    LinkedIn
                  </label>
                  <input
                    {...register("socialLinkedin")}
                    type="text"
                    placeholder="linkedin.com/in/username"
                    className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-[#172a46] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                <h4 className="font-bold text-[#172a46] mb-2">
                  📋 What Happens Next?
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>✓ We review your application within 24-48 hours</li>
                  <li>
                    ✓ You'll receive an email notification with the decision
                  </li>
                  <li>
                    ✓ If approved, you'll complete payment via your dashboard
                  </li>
                  <li>✓ Once paid, you're confirmed for the stay!</li>
                </ul>
              </div>

              {apiError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle
                    className="text-red-600 flex-shrink-0 mt-0.5"
                    size={20}
                  />
                  <div>
                    <p className="font-bold text-red-800">Error</p>
                    <p className="text-red-700">{apiError}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !isConnected || calculatedNights <= 0}
                className={`w-full text-lg font-semibold py-5 rounded-full inline-flex items-center justify-center gap-3 transition-all shadow-xl ${
                  isSubmitting || !isConnected || calculatedNights <= 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#172a46] text-white hover:scale-105"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting Application...</span>
                  </>
                ) : !isConnected ? (
                  <>
                    <Wallet size={20} />
                    <span>Connect Wallet to Continue</span>
                  </>
                ) : calculatedNights <= 0 ? (
                  <>
                    <Calendar size={20} />
                    <span>Select Your Dates First</span>
                  </>
                ) : (
                  <>
                    <span>
                      Submit Application ({calculatedNights} night
                      {calculatedNights !== 1 ? "s" : ""})
                    </span>
                    <ArrowRight size={22} />
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500">
                By submitting, you agree to our Terms of Service and Privacy
                Policy
              </p>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
