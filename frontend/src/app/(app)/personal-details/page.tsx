"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ChevronRight, User, Mail, Phone, MapPin, CreditCard } from "lucide-react";

function Section({ title, href, router }: { title: string; href?: string; router?: ReturnType<typeof useRouter> }) {
  return (
    <div className="flex items-center justify-between mt-5 mb-2 px-1">
      <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">{title}</p>
      {href && router && (
        <button onClick={() => router.push(href)} className="text-xs text-primary font-semibold hover:underline cursor-pointer">
          Edit
        </button>
      )}
    </div>
  );
}

function Row({
  label, value, icon: Icon, href, router, greyOut,
}: {
  label: string; value: string; icon?: React.ComponentType<{ size?: number; className?: string }>; href?: string; router: ReturnType<typeof useRouter>; greyOut?: boolean;
}) {
  const isLink = !!href;
  return (
    <button
      onClick={() => isLink && router.push(href!)}
      className={`w-full flex items-center justify-between px-4 py-4 border-b border-gray-50 last:border-0 bg-white ${isLink ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-full bg-[#EBF4FF] flex items-center justify-center shrink-0">
            <Icon size={15} className="text-primary" />
          </div>
        )}
        <div className="text-left">
          <p className="text-xs text-[#8E8E93]">{label}</p>
          <p className={`text-sm font-medium ${greyOut ? "text-gray-400" : "text-[#1D3B53]"}`}>{value || "—"}</p>
        </div>
      </div>
      {isLink && <ChevronRight size={16} className="text-gray-300" />}
    </button>
  );
}

export default function PersonalDetailsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const u = user as Record<string, any> || {};

  const kycLevel = u.kyc_level ?? u.verification_tier ?? 0;
  const kycLabel = kycLevel === 0 ? "Not Verified" : kycLevel === 1 ? "Tier 1 (Basic)" : kycLevel === 2 ? "Tier 2 (Advanced)" : `Tier ${kycLevel}`;

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/profile")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Personal Details</h1>
      </div>

      {/* Bio Data */}
      <Section title="Bio Data" href="/edit-personal-details" router={router} />
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <Row label="First Name" value={u.first_name || ""} icon={User} router={router} greyOut />
        <Row label="Last Name" value={u.last_name || ""} icon={User} router={router} greyOut />
        {u.other_name ? <Row label="Other Name" value={u.other_name} icon={User} router={router} greyOut /> : null}
        <Row label="Middle Name" value={u.middle_name || ""} icon={User} router={router} greyOut />
        <Row label="Username" value={u.username || ""} icon={User} href="/edit-username" router={router} />
        <Row label="Date of Birth" value={u.date_of_birth || u.dob || ""} router={router} greyOut />
      </div>

      {/* Contact Details */}
      <Section title="Contact Details" href="/edit-contact-details" router={router} />
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <Row label="Email Address" value={u.email || ""} icon={Mail} router={router} />
        <Row label="Phone Number" value={u.phone || u.phone_number || "Not set"} icon={Phone} href="/edit-contact-details" router={router} />
        <Row label="Country" value={u.country || ""} icon={MapPin} router={router} />
      </div>

      {/* Verification Details */}
      <Section title="Verification Details" />
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <Row label="KYC Level" value={kycLabel} icon={CreditCard} router={router} />
        <Row
          label="Verification Status"
          value={kycLevel > 0 ? "Verified" : "Not Verified"}
          router={router}
          href="/verification-dashboard"
        />
      </div>
    </div>
  );
}
