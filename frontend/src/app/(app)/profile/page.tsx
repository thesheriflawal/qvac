"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useVerificationGate } from "@/hooks/useVerificationGate";
import { p2pService } from "@/services/p2p.service";
import { User, Shield, Key, Users, FileText, HelpCircle, LogOut, ChevronRight, Bell, Copy, CheckCircle2, Star, MessageCircle, Trash2, ExternalLink } from "lucide-react";

const PLATFORM_ICONS: Record<string, string> = {
  whatsapp:  "https://cdn.simpleicons.org/whatsapp/25D366",
  telegram:  "https://cdn.simpleicons.org/telegram/229ED9",
  x:         "https://cdn.simpleicons.org/x/000000",
  twitter:   "https://cdn.simpleicons.org/x/000000",
  linkedin:  "https://cdn.simpleicons.org/linkedin/0A66C2",
  instagram: "https://cdn.simpleicons.org/instagram/E1306C",
  tiktok:    "https://cdn.simpleicons.org/tiktok/000000",
  discord:   "https://cdn.simpleicons.org/discord/5865F2",
  facebook:  "https://cdn.simpleicons.org/facebook/1877F2",
  youtube:   "https://cdn.simpleicons.org/youtube/FF0000",
};

const MENU = [
  { label: "Edit Profile", href: "/personal-details", icon: User },
  { label: "Verification", href: "/verification-dashboard", icon: Key, showBadge: true },
  { label: "Pin and 2FA Settings", href: "/security-settings", icon: Shield },
  { label: "Manage Notifications", href: "/manage-notifications", icon: Bell },
  { label: "Referrals", href: "/referrals", icon: Users },
];
const SUPPORT = [
  { label: "Contact Us", href: "/support", icon: HelpCircle },
  { label: "FAQs", href: "/#faq", icon: MessageCircle },
  { label: "Privacy Terms and Policies", href: "/privacy-policy", icon: FileText },
  { label: "Reviews", href: "/review", icon: Star },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isVerified } = useVerificationGate();
  const [copied, setCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [communityLinks, setCommunityLinks] = useState<any[]>([]);

  useEffect(() => {
    p2pService.getCommunityLinks()
      .then(res => setCommunityLinks(res?.data || []))
      .catch(() => {});
  }, []);

  const u = user as Record<string, any> || {};
  const name = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") || u.username || "User";
  const initials = name.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const uid = u.uid || u.referral_code || "";

  const copyUid = () => {
    if (uid) {
      navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full pb-10">
      {/* Breadcrumb */}
      <p className="text-xs text-[#8E8E93] mb-4">My Profile</p>

      {/* Blue Header Card */}
      <div className="bg-primary rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-lg truncate">{name}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {["Email", "SMS", "Identity"].map(badge => (
                  <span key={badge} className="flex items-center gap-1 text-xs text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5CB85C]"></span>
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {uid && (
            <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 flex items-center gap-2 min-w-0 sm:shrink-0">
              <span className="text-xs text-white/70 shrink-0">UID:</span>
              <span className="text-xs font-mono text-white truncate">{uid}</span>
              <button onClick={copyUid} className="text-white/80 hover:text-white cursor-pointer shrink-0">
                {copied ? <CheckCircle2 size={13} className="text-[#5CB85C]" /> : <Copy size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main menu */}
      <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-50">
        {MENU.map(m => (
          <button
            key={m.label}
            onClick={() => router.push(m.href)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#EBF4FF] flex items-center justify-center">
                <m.icon size={16} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-[#1D3B53]">{m.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {m.showBadge && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isVerified ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                  {isVerified ? "Verified" : "Not Verified"}
                </span>
              )}
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </button>
        ))}
      </div>

      {/* Help & Support */}
      <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-50">
        {SUPPORT.map(m => (
          <button
            key={m.label}
            onClick={() => router.push(m.href)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#EBF4FF] flex items-center justify-center">
                <m.icon size={16} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-[#1D3B53]">{m.label}</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>

      {/* Communities */}
      {communityLinks.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-50">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Communities</p>
          </div>
          {communityLinks.map((link: any) => {
            const platform = (link.platform || "").toLowerCase();
            const iconUrl = PLATFORM_ICONS[platform];
            const label = link.label || link.platform || platform;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EBF4FF] flex items-center justify-center overflow-hidden">
                    {iconUrl ? (
                      <img src={iconUrl} alt={platform} className="w-4 h-4 object-contain" />
                    ) : (
                      <ExternalLink size={16} className="text-primary" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-[#1D3B53] capitalize">{label}</span>
                </div>
                <ExternalLink size={14} className="text-gray-300" />
              </a>
            );
          })}
        </div>
      )}

      {/* Logout */}
      <div className="bg-white rounded-2xl overflow-hidden mb-3 shadow-sm border border-gray-50">
        <button
          onClick={async () => { await logout(); router.replace("/login"); }}
          className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
            <LogOut size={16} className="text-red-500" />
          </div>
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>

      {/* Delete Account */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50">
        <button
          onClick={() => setShowDelete(true)}
          className="w-full flex items-center gap-3 px-5 py-4 text-red-400 hover:bg-red-50 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 size={16} className="text-red-400" />
          </div>
          <span className="text-sm font-medium">Delete Account</span>
        </button>
      </div>

      {/* Delete Account Modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowDelete(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={26} className="text-red-500" />
            </div>
            <h3 className="font-bold text-xl text-[#1D3B53] text-center mb-2">Delete Account</h3>
            <p className="text-sm text-[#8E8E93] text-center mb-6 leading-relaxed">
              Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
            </p>
            <button
              onClick={() => router.push("/delete-account")}
              className="w-full bg-red-500 text-white font-bold py-4 rounded-xl mb-3 cursor-pointer"
            >
              Delete Account
            </button>
            <button
              onClick={() => setShowDelete(false)}
              className="w-full bg-[#F0F4F8] text-[#1D3B53] font-bold py-4 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
