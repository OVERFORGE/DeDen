// File: app/stay/[stayId]/apply/page.tsx
// ✅ UPDATED: Date range picker - users select check-in/check-out dates
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

// ✅ UPDATED: Added check-in/check-out dates
const applySchema = z.object({
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

  // ROOM SELECTION
  selectedRoomId: z.string().optional(),
  selectedCurrency: z.string().optional(),
  
  // ✅ NEW: DATE RANGE SELECTION
  checkInDate: z.string().min(1, "Please select check-in date"),
  checkOutDate: z.string().min(1, "Please select check-out date"),

  role: z.string().optional(),
  socialTwitter: z.string().optional(),
  socialLinkedin: z.string().optional(),
  socialTelegram: z.string().optional(),
}).refine(
    (data) => {
        if (data.selectedRoomId && data.selectedRoomId !== "") {
            return ["USDC", "USDT"].includes(data.selectedCurrency as string);
        }
        return true;
    },
    {
        message: "Please select a payment currency (USDC or USDT) for your preferred room.",
        path: ["selectedCurrency"], 
    }
).refine(
    (data) => {
        // Validate check-out is after check-in
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

  // ✅ NEW: Calculate nights whenever dates change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      
      if (checkOut > checkIn) {
        const diffTime = checkOut.getTime() - checkIn.getTime();
        const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setCalculatedNights(nights);
      } else {
        setCalculatedNights(0);
      }
    } else {
      setCalculatedNights(0);
    }
  }, [checkInDate, checkOutDate]);

  const handleRoomSelection = (roomId: string, currency: "USDC" | "USDT" | null) => {
    if (!roomId) {
      setValue("selectedRoomId", "");
      setValue("selectedCurrency", "");
    } else {
      setValue("selectedRoomId", roomId);
      setValue("selectedCurrency", currency || "", { shouldValidate: true });
    }
  };

  // ✅ FIXED: Safe price calculation
  const calculateTotalPrice = (pricePerNight: number | undefined | null): string => {
    const price = Number(pricePerNight) || 0;
    const nights = calculatedNights || 0;
    const total = price * nights;
    
    return isNaN(total) || total === 0 ? "0.00" : total.toFixed(2);
  };

  // ✅ NEW: Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchStayData = async () => {
      try {
        const response = await fetch(`/api/stays/${stayId}`);
        if (response.ok) {
          const data = await response.json();
          setStayData(data);
          
          // ✅ NEW: Set default dates to full stay
          if (data.startDate && data.endDate) {
            const checkIn = formatDateForInput(new Date(data.startDate));
            const checkOut = formatDateForInput(new Date(data.endDate));
            setValue("checkInDate", checkIn);
            setValue("checkOutDate", checkOut);
          }
        }
      } catch (error) {
        console.error("Error fetching stay data:", error);
      }
    };

    if (stayId && stayId !== "undefined") {
      fetchStayData();
    }
  }, [stayId, setValue]);

  useEffect(() => {
    if (session?.user) {
        const sessionUser = session.user as any; 
        
        reset({
            displayName: sessionUser.name || "",
            email: sessionUser.email || "",
            firstName: sessionUser.firstName || "",
            lastName: sessionUser.lastName || "",
            role: sessionUser.role || "",
            gender: applySchema.shape.gender.safeParse(sessionUser.gender).success
                ? sessionUser.gender
                : undefined, 
            age: !isNaN(parseFloat(sessionUser.age)) && isFinite(sessionUser.age) 
                ? Number(sessionUser.age) 
                : undefined, 
            mobileNumber: sessionUser.mobileNumber || "",
            socialTwitter: sessionUser.socialTwitter || "",
            socialLinkedin: sessionUser.socialLinkedin || "",
            socialTelegram: sessionUser.socialTelegram || "",
            selectedRoomId: "",
            selectedCurrency: "",
            checkInDate: stayData ? formatDateForInput(new Date(stayData.startDate)) : "",
            checkOutDate: stayData ? formatDateForInput(new Date(stayData.endDate)) : "",
        });
    }
  }, [session, reset, stayData]);

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
          numberOfNights: calculatedNights, // Send calculated nights to backend
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

      setIsSuccess(true);
    } catch (error: any) {
      console.error("Application error:", error);
      setApiError(error.message);
    }
  };

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
                <strong className="text-[#172a46]">{stayId}</strong> is now{" "}
                <strong>under review</strong>.
              </p>
              {checkInDate && checkOutDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 inline-block">
                  <p className="text-sm text-gray-600 mb-1">Your selected dates:</p>
                  <p className="font-semibold text-gray-800">
                    📅 {new Date(checkInDate).toLocaleDateString()} - {new Date(checkOutDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    <strong>{calculatedNights} night{calculatedNights !== 1 ? 's' : ''}</strong>
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
      {/* Hero Section */}
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
              Apply for {stayId}
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Complete your application below. You need to be signed in and have
              a wallet connected for payment processing.
            </p>
            {stayData && (
              <p className="text-md text-gray-400 mt-2">
                📅 Available: {new Date(stayData.startDate).toLocaleDateString()} - {new Date(stayData.endDate).toLocaleDateString()}
              </p>
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
              {/* ✅ NEW: Date Range Selection */}
              {stayData && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                  <label className="flex items-center gap-2 text-lg font-bold text-[#172a46] mb-4">
                    <Calendar size={20} />
                    Select Your Stay Dates
                    <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Check-In Date
                      </label>
                      <input
                        type="date"
                        {...register("checkInDate")}
                        min={formatDateForInput(new Date(stayData.startDate))}
                        max={formatDateForInput(new Date(stayData.endDate))}
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
                        Check-Out Date
                      </label>
                      <input
                        type="date"
                        {...register("checkOutDate")}
                        min={checkInDate || formatDateForInput(new Date(stayData.startDate))}
                        max={formatDateForInput(new Date(stayData.endDate))}
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

                  {/* ✅ NEW: Calculated Nights Display */}
                  {calculatedNights > 0 && (
                    <div className="bg-white border-2 border-blue-300 rounded-xl p-4 text-center">
                      <div className="text-4xl font-bold text-[#172a46] mb-1">
                        {calculatedNights}
                      </div>
                      <div className="text-sm text-gray-600">
                        night{calculatedNights !== 1 ? 's' : ''}
                      </div>
                      {checkInDate && checkOutDate && (
                        <div className="text-xs text-gray-500 mt-2">
                          {new Date(checkInDate).toLocaleDateString()} → {new Date(checkOutDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 mt-3 text-center">
                    Choose any dates within the stay period ({new Date(stayData.startDate).toLocaleDateString()} - {new Date(stayData.endDate).toLocaleDateString()})
                  </p>
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

              {/* Age and Mobile */}
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

              {/* ✅ UPDATED: Room Selection with Dynamic Pricing based on calculated nights */}
              {stayData && stayData.rooms && stayData.rooms.length > 0 && calculatedNights > 0 && (
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
                                {/* USDC Option */}
                                <label
                                    className={`flex-1 border-2 rounded-xl cursor-pointer transition-all ${
                                        currentSelectedRoomId === room.id && currentSelectedCurrency === "USDC"
                                            ? "border-green-600 bg-green-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    }`}
                                    onClick={() => handleRoomSelection(room.id, "USDC")}
                                >
                                    <div className="p-3">
                                        <input
                                            type="radio"
                                            name={`room_currency_${room.id}`}
                                            className="sr-only"
                                            checked={currentSelectedRoomId === room.id && currentSelectedCurrency === "USDC"}
                                            readOnly
                                        />
                                        <div className="text-center">
                                            <div className="font-bold text-sm text-green-700 mb-1">
                                                ${room.priceUSDC || 0}/night
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                Total: <strong className="text-green-700">${calculateTotalPrice(room.priceUSDC)} USDC</strong>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {calculatedNights} night{calculatedNights !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>
                                </label>

                                {/* USDT Option */}
                                <label
                                    className={`flex-1 border-2 rounded-xl cursor-pointer transition-all ${
                                        currentSelectedRoomId === room.id && currentSelectedCurrency === "USDT"
                                            ? "border-purple-600 bg-purple-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    }`}
                                    onClick={() => handleRoomSelection(room.id, "USDT")}
                                >
                                    <div className="p-3">
                                        <input
                                            type="radio"
                                            name={`room_currency_${room.id}`}
                                            className="sr-only"
                                            checked={currentSelectedRoomId === room.id && currentSelectedCurrency === "USDT"}
                                            readOnly
                                        />
                                        <div className="text-center">
                                            <div className="font-bold text-sm text-purple-700 mb-1">
                                                ${room.priceUSDT || 0}/night
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                Total: <strong className="text-purple-700">${calculateTotalPrice(room.priceUSDT)} USDT</strong>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {calculatedNights} night{calculatedNights !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                      </div>
                    ))}

                    {/* No Room Preference */}
                    <label
                      className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all block ${
                        currentSelectedRoomId === ""
                          ? "border-gray-400 bg-gray-50 shadow-md"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => handleRoomSelection("", null)}
                    >
                        <input
                            type="radio"
                            {...register("selectedRoomId")}
                            value=""
                            className="sr-only"
                        />
                        <h4 className="font-bold text-gray-600 text-lg mb-1">
                            No Room Preference (Default)
                        </h4>
                        <p className="text-sm text-gray-500">
                            I will accept any available room, and the currency will be determined upon approval.
                        </p>
                        {currentSelectedRoomId === "" && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                                <Check size={16} className="text-white" />
                            </div>
                        )}
                    </label>
                  </div>
                  
                  {currentSelectedRoomId && currentSelectedRoomId !== "" && errors.selectedCurrency && (
                    <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.selectedCurrency.message}
                    </p>
                  )}
                </div>
              )}

              {/* Name Fields */}
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

              {/* Professional Role */}
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

              {/* Social Links */}
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

              {/* Info Box */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                <h4 className="font-bold text-[#172a46] mb-2">
                  📋 What Happens Next?
                </h4>
                <ul className="space-y-2 text-gray-700">
                  <li>✓ We review your application within 24-48 hours</li>
                  <li>✓ You'll receive an email notification with the decision</li>
                  <li>✓ If approved, you'll complete payment via your dashboard</li>
                  <li>✓ Once paid, you're confirmed for the stay!</li>
                </ul>
              </div>

              {/* Error Message */}
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

              {/* Submit Button */}
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
                    <span>Submit Application ({calculatedNights} night{calculatedNights !== 1 ? 's' : ''})</span>
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