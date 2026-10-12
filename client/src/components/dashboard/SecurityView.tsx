"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MonitorSmartphone } from "lucide-react";
import { useAppDispatch } from "@/redux/hooks";
import { clearAuth } from "@/redux/slice/auth.slice";
import { AuthService } from "@/services/auth.service";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { DashboardCard, DashboardEmptyState } from "@/components/dashboard/DashboardPrimitives";

interface SessionRow {
  id: string;
  created_at: string;
  current: boolean;
}

const inputWrapperClass = "space-y-1.5";

export function SecurityView() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [sessionsError, setSessionsError] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    AuthService.listSessions()
      .then((data) => setSessions(data?.sessions ?? []))
      .catch(() => setSessionsError(true));
  }, []);

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (passwords.newPassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await AuthService.changePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      setMessage("Password updated. Other devices have been signed out.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setBusySessionId(id);
    try {
      await AuthService.revokeSession(id);
      setSessions((current) => current?.filter((session) => session.id !== id) ?? current);
    } catch {
      setSessionsError(true);
    } finally {
      setBusySessionId(null);
    }
  }

  async function logoutAllDevices() {
    setLoggingOutAll(true);
    try {
      await AuthService.logoutAll();
      dispatch(clearAuth());
      router.replace("/login");
    } finally {
      setLoggingOutAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--brand-navy)">Security</h1>
        <p className="mt-1 text-sm text-(--brand-text-secondary)">Manage your password and active sessions.</p>
      </div>

      <DashboardCard title="Change password">
        <form onSubmit={submitPasswordChange} className="max-w-md space-y-4" noValidate>
          {error ? <p className="text-sm text-(--status-danger)">{error}</p> : null}
          {message ? <p className="text-sm text-(--status-success)">{message}</p> : null}
          <div className={inputWrapperClass}>
            <label htmlFor="current-password" className="block text-sm font-semibold text-(--brand-text)">
              Current password
            </label>
            <PasswordInput
              id="current-password"
              value={passwords.currentPassword}
              onChange={(value) => setPasswords((current) => ({ ...current, currentPassword: value }))}
              autoComplete="current-password"
            />
          </div>
          <div className={inputWrapperClass}>
            <label htmlFor="new-password" className="block text-sm font-semibold text-(--brand-text)">
              New password
            </label>
            <PasswordInput
              id="new-password"
              value={passwords.newPassword}
              onChange={(value) => setPasswords((current) => ({ ...current, newPassword: value }))}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="flex h-11 items-center gap-2 rounded-(--radius-md) bg-(--brand-red) px-5 text-sm font-semibold text-white hover:bg-(--brand-red-hover) disabled:opacity-60"
          >
            {pending ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Updating...
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      </DashboardCard>

      <DashboardCard
        title="Active sessions"
        description="Devices currently signed in to your account."
        action={
          <button
            type="button"
            onClick={logoutAllDevices}
            disabled={loggingOutAll}
            className="text-sm font-semibold text-(--status-danger) hover:underline"
          >
            {loggingOutAll ? "Logging out..." : "Log out of all devices"}
          </button>
        }
      >
        {sessionsError ? (
          <p className="text-sm text-(--status-danger)">We couldn&apos;t load your sessions.</p>
        ) : sessions === null ? (
          <p className="text-sm text-(--brand-text-secondary)">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <DashboardEmptyState title="No active sessions" description="Your active sessions will appear here." />
        ) : (
          <ul className="divide-y divide-(--brand-border)">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <MonitorSmartphone size={18} className="text-(--brand-text-muted)" />
                  <div>
                    <p className="text-sm font-medium text-(--brand-text)">
                      {session.current ? "This device" : "Other device"}
                    </p>
                    <p className="text-xs text-(--brand-text-muted)">
                      Signed in {new Date(session.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!session.current ? (
                  <button
                    type="button"
                    onClick={() => revoke(session.id)}
                    disabled={busySessionId === session.id}
                    className="text-sm font-semibold text-(--status-danger) hover:underline disabled:opacity-50"
                  >
                    Log out
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}
