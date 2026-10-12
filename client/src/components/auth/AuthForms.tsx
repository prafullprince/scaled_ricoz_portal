"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  Search,
} from "lucide-react";
import { AuthService } from "@/services/auth.service";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  clearSignupData,
  setSession,
  setSignupData,
} from "@/redux/slice/auth.slice";
import { USER_ROLES } from "@/lib/auth/roles";
import { DEMO_ACCOUNTS, type DemoAccountGroup } from "@/lib/auth/demoAccounts";
import { AuthLayout, Field, FormMessage, inputClassName } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeRedirect = (value: string | null) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";

const roleRedirect = (user?: {
  roles?: string[];
  organization_department?: string | null;
}) =>
  user?.organization_department === "MARKETING"
    ? "/dashboard/marketing"
    : user?.organization_department === "SALES"
      ? "/dashboard/sales"
      : user?.organization_department === "HR"
        ? "/dashboard/hr"
        : user?.roles?.includes(USER_ROLES.EMPLOYEE)
          ? "/dashboard/employee"
          : user?.roles?.includes(USER_ROLES.INVESTOR)
            ? "/dashboard/investor"
            : user?.roles?.includes(USER_ROLES.CUSTOMER)
              ? "/dashboard/customer"
              : user?.roles?.includes(USER_ROLES.INTERN)
                ? "/dashboard/intern"
                : "/dashboard";

const authorizedRedirect = (
  requested: string | null,
  user?: { roles?: string[]; organization_department?: string | null },
) => {
  const fallback = roleRedirect(user);
  if (!requested) return fallback;
  const target = safeRedirect(requested);
  const roles = user?.roles ?? [];
  if (
    target.startsWith("/dashboard/hr") &&
    !roles.some(
      (role) => role === USER_ROLES.HR_HEAD || role === USER_ROLES.HR_MANAGER,
    )
  )
    return fallback;
  if (
    target.startsWith("/dashboard/marketing") &&
    user?.organization_department !== "MARKETING" &&
    !roles.some(
      (role) =>
        role === USER_ROLES.MARKETING_HEAD ||
        role === USER_ROLES.MARKETING_MANAGER,
    )
  )
    return fallback;
  if (
    target.startsWith("/dashboard/sales") &&
    user?.organization_department !== "SALES" &&
    !roles.some(
      (role) =>
        role === USER_ROLES.SALES_HEAD || role === USER_ROLES.SALES_MANAGER,
    )
  )
    return fallback;
  return target;
};

const buttonClassName =
  "flex h-12 w-full items-center justify-center gap-2 rounded-(--radius-md) bg-(--brand-red) px-5 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover) focus:outline-none focus:ring-4 focus:ring-(--brand-red-soft) disabled:cursor-not-allowed disabled:opacity-60";

function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-semibold tracking-tight text-(--brand-navy)">
        {title}
      </h2>
      <p className="mt-3 text-[15px] leading-6 text-(--brand-text-secondary)">
        {description}
      </p>
    </div>
  );
}

const demoGroups: Array<{ value: DemoAccountGroup; label: string }> = [
  { value: "hq", label: "HQ Teams" },
  { value: "employees", label: "Employees" },
  { value: "external", label: "External" },
];

const subscribeToBrowser = () => () => {};
const isLocalhostDevelopment = () =>
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

// Login Form
export function LoginForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [demoGroup, setDemoGroup] = useState<DemoAccountGroup>("hq");
  const [demoView, setDemoView] = useState<"featured" | "all">("featured");
  const [demoSearch, setDemoSearch] = useState("");
  const [demoPendingEmail, setDemoPendingEmail] = useState<string | null>(null);
  const showDemoAccounts = useSyncExternalStore(
    subscribeToBrowser,
    isLocalhostDevelopment,
    () => false,
  );
  const demoAccounts = DEMO_ACCOUNTS.filter(
    (account) => account.group === demoGroup,
  )
    .filter((account) => demoView === "all" || account.featured)
    .filter((account) =>
      `${account.name} ${account.email} ${account.designation} ${account.department}`
        .toLowerCase()
        .includes(demoSearch.trim().toLowerCase()),
    );

  async function authenticate(loginEmail: string, loginPassword: string) {
    const result = await AuthService.login({
      email: loginEmail,
      password: loginPassword,
    });
    if (result?.user && result.access_token)
      dispatch(
        setSession({ accessToken: result.access_token, user: result.user }),
      );
    router.replace(
      authorizedRedirect(searchParams.get("redirect"), result?.user),
    );
  }

  async function loginDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    if (pending) return;
    setEmail(account.email);
    setPassword(account.password);
    setError("");
    setPending(true);
    setDemoPendingEmail(account.email);
    try {
      await authenticate(account.email, account.password);
    } catch {
      setError(
        "Demo login failed. Confirm the demo accounts were seeded and try again.",
      );
    } finally {
      setPending(false);
      setDemoPendingEmail(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!emailPattern.test(email))
      return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setPending(true);
    try {
      await authenticate(email, password);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.";
      setError(
        message.toLowerCase().includes("verify your email")
          ? "Your previous signup was never completed. Please sign up again to continue."
          : message.toLowerCase().includes("too many")
            ? "Too many attempts. Please try again later."
            : message.toLowerCase().includes("incorrect") ||
                message.toLowerCase().includes("not found")
              ? "Email or password is incorrect."
              : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout contentClassName="max-w-150">
      <Heading
        title="Welcome back"
        description="Sign in to continue to your Ricoz account."
      />
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Field id="login-email" label="Email address">
          <input
            id="login-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className={inputClassName()}
            required
          />
        </Field>
        <Field id="login-password" label="Password">
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-(--brand-red) hover:underline">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      {showDemoAccounts ? (
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#263c69] bg-[#142953] text-white shadow-[0_12px_30px_rgba(14,35,78,0.16)]">
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Quick Access</h3>
                <p className="mt-1 text-xs text-white/50">
                  Click any account to sign in instantly
                </p>
              </div>
              <span className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold text-white/45">
                DEMO MODE
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 border-b border-white/10">
              {demoGroups.map((group) => (
                <button
                  key={group.value}
                  type="button"
                  onClick={() => {
                    setDemoGroup(group.value);
                    setDemoView(group.value === "hq" ? "featured" : "all");
                  }}
                  className={`border-b-2 px-2 py-3 text-xs font-bold transition ${demoGroup === group.value ? "border-[#56a8ff] bg-white/10 text-white" : "border-transparent text-white/45 hover:text-white/80"}`}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <label className="flex h-9 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3">
                <Search size={13} className="text-white/40" />
                <input
                  value={demoSearch}
                  onChange={(event) => setDemoSearch(event.target.value)}
                  placeholder="Search 50 demo accounts"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
                />
              </label>
              <div className="flex rounded-md border border-white/15 p-0.5">
                <button
                  type="button"
                  onClick={() => setDemoView("featured")}
                  className={`rounded px-2 py-1.5 text-[10px] font-bold ${demoView === "featured" ? "bg-white/15 text-white" : "text-white/45"}`}
                >
                  Featured
                </button>
                <button
                  type="button"
                  onClick={() => setDemoView("all")}
                  className={`rounded px-2 py-1.5 text-[10px] font-bold ${demoView === "all" ? "bg-white/15 text-white" : "text-white/45"}`}
                >
                  All
                </button>
              </div>
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
              {demoView === "featured"
                ? "Featured roles"
                : `${demoAccounts.length} accounts`}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto border-t border-white/10 p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={pending}
                  onClick={() => void loginDemo(account)}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/3 p-3 text-left transition hover:border-[#56a8ff]/60 hover:bg-white/8 disabled:opacity-50"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: account.color }}
                  >
                    {account.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {account.name}
                    </span>
                    <span className="block truncate text-xs text-white/45">
                      {account.department} · {account.email}
                    </span>
                  </span>
                  {demoPendingEmail === account.email ? (
                    <LoaderCircle size={15} className="shrink-0 animate-spin" />
                  ) : (
                    <ArrowRight size={14} className="shrink-0 text-white/30" />
                  )}
                </button>
              ))}
              {!demoAccounts.length ? (
                <p className="col-span-full py-8 text-center text-xs text-white/50">
                  No demo accounts match this filter.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-center text-sm text-(--brand-text-secondary)">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-(--brand-red) hover:underline"
        >
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!emailPattern.test(email)) return setError("Enter a valid email address.");
    setPending(true);
    try {
      const result = await AuthService.requestPasswordReset(email);
      setMessage(result.message);
      setCodeSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request a password reset.");
    } finally {
      setPending(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your email.");
    if (newPassword.length < 8) return setError("Your password must contain at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    setPending(true);
    try {
      const result = await AuthService.resetPassword({ email, otp, newPassword });
      setMessage(result.message);
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset your password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout contentClassName="max-w-150">
      <Heading
        title={complete ? "Password updated" : "Reset your password"}
        description={complete ? "Your account is secured with the new password." : "We’ll email a one-time code to verify your account."}
      />
      {complete ? (
        <div className="space-y-5">
          <p role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} />{message}</p>
          <Link href="/login" className={buttonClassName}>Return to sign in <ArrowRight size={17} /></Link>
        </div>
      ) : codeSent ? (
        <form onSubmit={submitReset} className="space-y-5" noValidate>
          {error ? <FormMessage>{error}</FormMessage> : null}
          {message ? <p role="status" className="rounded-md bg-(--brand-surface) px-3 py-2 text-sm text-(--brand-text-secondary)">{message}</p> : null}
          <Field id="reset-email" label="Email address">
            <input id="reset-email" type="email" value={email} readOnly className={inputClassName()} />
          </Field>
          <Field id="reset-code" label="6-digit code">
            <input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} className={inputClassName()} required />
          </Field>
          <Field id="reset-password" label="New password">
            <PasswordInput id="reset-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          </Field>
          <Field id="reset-confirm-password" label="Confirm new password">
            <PasswordInput id="reset-confirm-password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          </Field>
          <button type="submit" className={buttonClassName} disabled={pending}>
            {pending ? <><LoaderCircle size={17} className="animate-spin" />Updating password...</> : <>Reset password <ArrowRight size={17} /></>}
          </button>
          <button type="button" disabled={pending} onClick={() => { setCodeSent(false); setMessage(""); setError(""); }} className="w-full text-sm font-semibold text-(--brand-red) hover:underline">Use another email address</button>
        </form>
      ) : (
        <form onSubmit={requestCode} className="space-y-5" noValidate>
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Field id="forgot-email" label="Email address">
            <input id="forgot-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName()} required />
          </Field>
          <button type="submit" className={buttonClassName} disabled={pending}>
            {pending ? <><LoaderCircle size={17} className="animate-spin" />Sending code...</> : <><MailCheck size={17} />Send reset code</>}
          </button>
        </form>
      )}
      {!complete ? <p className="mt-7 text-center text-sm text-(--brand-text-secondary)">Remembered your password? <Link href="/login" className="font-semibold text-(--brand-red) hover:underline">Sign in</Link></p> : null}
    </AuthLayout>
  );
}

// Signup Form
export function SignupForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get("email")?.trim() ?? "";
  const [form, setForm] = useState({
    name: "",
    email: invitedEmail,
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.name.trim().length < 3) return setError("Enter your full name.");
    if (!emailPattern.test(form.email))
      return setError("Enter a valid email address.");
    if (form.password.length < 8)
      return setError("Your password must contain at least 8 characters.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match.");
    setPending(true);
    try {
      // The account is only created after OTP verification; this call only sends the code.
      await AuthService.sendOtp(form.email);
      dispatch(
        setSignupData({
          ...form,
        }),
      );
      const redirect = safeRedirect(searchParams.get("redirect"));
      router.replace(`/verify-email?redirect=${encodeURIComponent(redirect)}`);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.";
      setError(
        message.toLowerCase().includes("exists")
          ? "An account with this email already exists."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <Heading
        title="Create your Ricoz account"
        description={invitedEmail
          ? "A recruiter created a candidate profile for you. Verify this email to activate your account and continue the recruitment process."
          : "Create a standard Ricoz account. Organization access is reviewed separately."}
      />
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Field id="signup-name" label="Full name">
          <input
            id="signup-name"
            type="text"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="name"
            className={inputClassName()}
            required
          />
        </Field>
        <Field id="signup-email" label="Email address">
          <input
            id="signup-email"
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="email"
            className={inputClassName()}
            required
          />
        </Field>
        <Field id="signup-password" label="Password">
          <PasswordInput
            id="signup-password"
            value={form.password}
            onChange={(value) => update("password", value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-(--brand-text-muted)">
            Use at least 8 characters.
          </p>
        </Field>
        <Field id="signup-confirm-password" label="Confirm password">
          <PasswordInput
            id="signup-confirm-password"
            value={form.confirmPassword}
            onChange={(value) => update("confirmPassword", value)}
            autoComplete="new-password"
            error={Boolean(
              form.confirmPassword && form.password !== form.confirmPassword,
            )}
          />
        </Field>
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-(--brand-text-secondary)">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-(--brand-red) hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
};

// Verify Email
export function VerifyEmailForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const signupData = useAppSelector((state) => state.auth.signupData);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"waiting" | "success">("waiting");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [createdRoles, setCreatedRoles] = useState<string[]>([]);
  const [onboardingPending, setOnboardingPending] = useState(false);

  // Signup
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!signupData) return;
    if (!/^\d{6}$/.test(otp))
      return setMessage("Enter the 6-digit verification code.");
    setPending(true);
    try {
      // Account creation happens here, only after the OTP is validated by the server.
      const result = await AuthService.signup({ ...signupData, otp });
      setOnboardingPending(Boolean(result?.onboardingPending));
      if (result?.user && result.access_token) {
        dispatch(
          setSession({ accessToken: result.access_token, user: result.user }),
        );
        setCreatedRoles(result.user.roles);
      }
      dispatch(clearSignupData());
      setStatus("success");
    } catch {
      setMessage("This verification code is invalid or has expired.");
    } finally {
      setPending(false);
    }
  }

  // Resend Mail
  async function resend() {
    if (!signupData) return;
    setMessage("");
    setResending(true);
    try {
      await AuthService.sendOtp(signupData.email);
      setMessage("Verification email sent.");
    } catch {
      setMessage(
        "We could not send a new email right now. Please try again later.",
      );
    } finally {
      setResending(false);
    }
  }

  // Signup Expired
  if (!signupData && status !== "success")
    return (
      <AuthLayout>
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-(--brand-navy)">
            Your signup session has expired
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-(--brand-text-secondary)">
            Please start the signup process again.
          </p>
          <Link
            href="/signup"
            className={`${buttonClassName} mt-8 inline-flex`}
          >
            Back to sign up <ArrowRight size={17} />
          </Link>
        </div>
      </AuthLayout>
    );

  // Signup succeed
  if (status === "success")
    return (
      <AuthLayout>
        <div className="text-center">
          <CheckCircle2 size={48} className="mx-auto text-(--status-success)" />
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-(--brand-navy)">
            Email verified
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-(--brand-text-secondary)">
            {onboardingPending ? "Your email is verified. Your profile is waiting for review by the organization." : "Your account is ready. Continue to your Ricoz experience."}
          </p>
          <button
            type="button"
            className={`${buttonClassName} mt-8`}
            onClick={() =>
              router.replace(onboardingPending ? "/login" : searchParams.get("redirect") ? safeRedirect(searchParams.get("redirect")) : roleRedirect({ roles: createdRoles }))
            }
          >
            {onboardingPending ? "Back to sign in" : "Continue"} <ArrowRight size={17} />
          </button>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <div className="mb-8">
        <MailCheck size={32} className="text-(--brand-red)" />
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-(--brand-navy)">
          Verify your email
        </h2>
        <p className="mt-3 text-[15px] leading-6 text-(--brand-text-secondary)">
          We sent a 6-digit verification code to{" "}
          <strong>{maskEmail(signupData!.email)}</strong>.
        </p>
      </div>
      <form onSubmit={verify} className="space-y-5" noValidate>
        {message ? (
          <FormMessage tone={message.includes("sent") ? "success" : "error"}>
            {message}
          </FormMessage>
        ) : null}
        <Field id="verification-code" label="Verification code">
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            autoComplete="one-time-code"
            className={`${inputClassName()} tracking-[0.35em]`}
            required
          />
        </Field>
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Verify email <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <button
        type="button"
        onClick={resend}
        disabled={resending}
        className="mt-5 w-full text-center text-sm font-semibold text-(--brand-red) hover:underline disabled:opacity-50"
      >
        {resending ? "Sending..." : "Resend verification email"}
      </button>
      <p className="mt-6 text-center text-sm text-(--brand-text-secondary)">
        Entered the wrong email?{" "}
        <Link
          href="/signup"
          className="font-semibold text-(--brand-red) hover:underline"
          onClick={() => dispatch(clearSignupData())}
        >
          Start again
        </Link>
      </p>
    </AuthLayout>
  );
}
