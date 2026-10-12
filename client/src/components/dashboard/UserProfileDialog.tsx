"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BriefcaseBusiness,
  Building2,
  LoaderCircle,
  Mail,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  OrganizationService,
  type OrganizationProfile,
} from "@/services/organization.service";

function readable(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function UserProfileDialog({
  userId,
  companyId,
  onClose,
}: {
  userId: string | null;
  companyId?: string;
  onClose: () => void;
}) {
  const [result, setResult] = useState<{
    userId: string;
    companyId?: string;
    profile: OrganizationProfile;
  } | null>(null);
  const [failure, setFailure] = useState<{ userId: string; companyId?: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    OrganizationService.profile(userId, companyId)
      .then((profile) => active && setResult({ userId, companyId, profile }))
      .catch(() => active && setFailure({ userId, companyId }));
    return () => {
      active = false;
    };
  }, [companyId, userId]);

  if (!userId) return null;
  const profile =
    result?.userId === userId && result.companyId === companyId
      ? result.profile
      : null;
  const error =
    failure?.userId === userId && failure.companyId === companyId;
  const loading = !profile && !error;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#101a2c]/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close profile"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Profile details"
        className="relative w-full max-w-md overflow-hidden rounded-lg bg-white shadow-[0_28px_80px_rgba(16,26,44,0.3)]"
      >
        <header className="flex items-center justify-between border-b border-[#e3e6eb] px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#c91d20]">Internal profile</p>
            <h2 className="mt-0.5 text-lg font-extrabold text-[#18243a]">Employee details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] hover:bg-[#f1f3f6]"
          >
            <X size={19} />
          </button>
        </header>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <LoaderCircle className="animate-spin text-[#c91d20]" size={25} />
          </div>
        ) : error ? (
          <p className="px-5 py-16 text-center text-sm text-[#667085]">Profile details are unavailable.</p>
        ) : profile ? (
          <div className="px-5 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#18243a] text-lg font-extrabold text-white">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xl font-extrabold text-[#18243a]">{profile.name}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.roles.map((role) => (
                    <span key={role} className="rounded-sm bg-[#eef4ff] px-2 py-1 text-[10px] font-bold text-[#1645a2]">
                      {readable(role)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <dl className="mt-6 divide-y divide-[#edf0f3] border-y border-[#edf0f3]">
              <Detail icon={Mail} label="Email" value={profile.email} />
              <Detail icon={BriefcaseBusiness} label="Working role" value={profile.workingRole ? readable(profile.workingRole) : "Not assigned"} />
              <Detail icon={Building2} label="Organization" value={[profile.department && readable(profile.department), profile.level && readable(profile.level)].filter(Boolean).join(" · ") || "Not assigned"} />
              <Detail icon={UserRoundCheck} label="Works under" value={profile.reportsTo?.name ?? "No reporting manager"} />
            </dl>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <Icon size={18} className="mt-0.5 shrink-0 text-[#8a93a3]" />
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase text-[#8a93a3]">{label}</dt>
        <dd className="mt-0.5 wrap-break-word text-sm font-semibold text-[#344054]">{value}</dd>
      </div>
    </div>
  );
}
