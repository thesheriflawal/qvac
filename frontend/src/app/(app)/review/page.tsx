"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { reviewService } from "@/services/review.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft, Star, CheckCircle2 } from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const u = user as Record<string, any> || {};

  const [name, setName] = useState([u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "");
  const [email, setEmail] = useState(u.email || "");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (!content.trim()) { setError("Please write your review"); return; }
    setLoading(true);
    try {
      await reviewService.submitReview({ name: name.trim(), email: email.trim(), content: content.trim() });
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/profile")} className="p-1 cursor-pointer">
            <ArrowLeft size={22} className="text-[#1D3B53]" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 size={44} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-[#1D3B53] mb-2">Review Submitted!</h2>
          <p className="text-sm text-[#8E8E93] leading-relaxed mb-8">
            Thank you for sharing your experience. Your feedback helps us improve our service.
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="w-full max-w-sm bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/profile")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Write a Review</h1>
      </div>

      {/* Star rating */}
      <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-[#1D3B53] mb-3 text-center">How would you rate your experience?</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="cursor-pointer transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className={`transition-colors ${(hovered || rating) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-xs text-[#8E8E93] mt-2">
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-[#EBF4FF] border border-transparent rounded-xl px-4 py-3 text-sm outline-none focus:border-primary text-[#1D3B53] placeholder:text-[#8E8E93]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full bg-[#EBF4FF] border border-transparent rounded-xl px-4 py-3 text-sm outline-none focus:border-primary text-[#1D3B53] placeholder:text-[#8E8E93]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">Your Review</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Share your experience with Kynettic..."
            rows={5}
            className="w-full bg-[#EBF4FF] border border-transparent rounded-xl px-4 py-3 text-sm outline-none focus:border-primary text-[#1D3B53] placeholder:text-[#8E8E93] resize-none"
          />
          <p className="text-xs text-[#8E8E93] text-right mt-1">{content.length}/500</p>
        </div>

        <button
          type="submit"
          disabled={loading || !content.trim() || !name.trim() || !email.trim()}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
}
