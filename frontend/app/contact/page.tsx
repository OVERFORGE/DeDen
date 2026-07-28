"use client";

import { Mail, User, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#f7eedb] text-[#2c331f] selection:bg-[#9db47d] selection:text-[#2c331f]">
      {/* Hero */}
      <section className="pt-24 pb-12 bg-[#f7eedb] relative overflow-hidden">
        {/* Background shapes */}
        <div className="absolute top-10 right-10 w-64 h-64 bg-[#ede3c9] rounded-full opacity-50 z-0"></div>
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 flex flex-col items-center">
          <p className="text-sm italic font-bold text-[#7e9154] tracking-wider mb-2 rotate-[-2deg]">always around ✦</p>
          <h1 className="text-6xl md:text-[5rem] font-black mb-6 font-display leading-[0.9] tracking-tight">
            Drop us a line
          </h1>
          <p className="text-[#2c331f]/80 text-sm md:text-base max-w-xl mx-auto font-medium leading-relaxed">
            Have a question about our stays, bookings, or partnerships? We’re
            here to help you 24/7.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="pb-24 pt-6 bg-[#f7eedb]">
        <div className="max-w-2xl mx-auto px-6 relative">
          
          <div className="bg-white rounded-2xl shadow-[8px_8px_0px_0px_#2c331f] p-8 md:p-12 border-2 border-[#2c331f]">
            <h2 className="text-2xl font-black text-[#2c331f] mb-8 font-display tracking-wide flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#9db47d] border-2 border-[#2c331f] inline-flex items-center justify-center">
                <MessageSquare size={14} className="text-[#2c331f]" strokeWidth={3} />
              </span>
              SEND A MESSAGE
            </h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setStatus("idle");
                setErrorMsg(null);
                try {
                  const res = await fetch("/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, message }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to send message");
                  setStatus("success");
                  setName("");
                  setEmail("");
                  setMessage("");
                } catch (err: any) {
                  setStatus("error");
                  setErrorMsg(err.message);
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-6"
            >
              {/* Name */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#2c331f] mb-2 uppercase tracking-widest">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={18} className="text-[#2c331f]/50" />
                  </div>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 text-sm font-bold bg-[#f7eedb]/30 border-2 border-[#2c331f] rounded-xl focus:bg-white focus:shadow-[4px_4px_0px_0px_#2c331f] focus:outline-none transition-all placeholder:text-[#2c331f]/40 placeholder:font-normal"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#2c331f] mb-2 uppercase tracking-widest">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={18} className="text-[#2c331f]/50" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 text-sm font-bold bg-[#f7eedb]/30 border-2 border-[#2c331f] rounded-xl focus:bg-white focus:shadow-[4px_4px_0px_0px_#2c331f] focus:outline-none transition-all placeholder:text-[#2c331f]/40 placeholder:font-normal"
                    required
                  />
                </div>
              </div>

              {/* Query / Message */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#2c331f] mb-2 uppercase tracking-widest">
                  Your Message
                </label>
                <textarea
                  placeholder="What's on your mind?..."
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-5 text-sm font-bold bg-[#f7eedb]/30 border-2 border-[#2c331f] rounded-xl focus:bg-white focus:shadow-[4px_4px_0px_0px_#2c331f] focus:outline-none transition-all resize-none placeholder:text-[#2c331f]/40 placeholder:font-normal"
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-4 text-sm font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#2c331f] inline-flex items-center justify-center gap-3 transition-all
                  ${
                    loading
                      ? "bg-[#e8c37b]/50 text-[#2c331f]/50 cursor-wait shadow-[0px_0px_0px_0px_#2c331f] translate-y-1 translate-x-1"
                      : "bg-[#9db47d] text-[#2c331f] hover:bg-[#8ca36c] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1"
                  }
                `}
              >
                {loading ? (
                  <div className="w-5 h-5 border-4 border-[#2c331f] border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Send Message ✦"
                )}
              </button>

              {status === "success" && (
                <div className="flex items-center gap-2 text-sm font-bold text-[#3D4331] bg-[#EEF2E6] border-2 border-[#8A9670] rounded-xl px-4 py-3">
                  <CheckCircle2 size={16} /> Message sent — we'll get back to you soon.
                </div>
              )}
              {status === "error" && (
                <div className="flex items-center gap-2 text-sm font-bold text-[#7A2A20] bg-[#FBE7E4] border-2 border-[#C24A3D] rounded-xl px-4 py-3">
                  <AlertCircle size={16} /> {errorMsg || "Something went wrong. Please try again."}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
