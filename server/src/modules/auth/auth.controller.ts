import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../../models/user.models.js";
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifyEmailDto,
} from "./auth.validation.js";
import { Application, ApplicationSource, Company, EmployeeProfile, EmploymentType, InternProfile, OrganizationAssignment, OrganizationDepartment, OrganizationLevel, OTP, SalesDesignation, Session, SystemRoleAssignment, User } from "../../models/index.js";
import { OtpPurpose } from "../../models/otp.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import otpGenerator from "otp-generator";
import { sendEmail, sendVerificationCodeEmail, sendWelcomeEmail } from "../../utils/email.utils.js";
import bcrypt from "bcryptjs";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
} from "../../utils/tokens.js";
import { normalizeRoles, ROLE_PERMISSIONS, UserRole, UserStatus } from "./authorization.js";
import { expireWorkRoles } from "../recruitment/role-expiry.service.js";
import { runWithCompany } from "../company/company.context.js";
import { companyView, hasOtherCompanyAssignment, isGroupExecutive, resolveUserCompany } from "../company/company.service.js";
import { resolveCompanyRoleContext } from "../organization/organization.roles.js";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // innovation.ricoz.in and innovationapi.ricoz.in are same-site subdomains.
  sameSite: "lax" as const,
};

const isMobileClient = (req: Request) =>
  req.get("x-client-platform")?.toLowerCase() === "mobile";

const refreshTokenFromRequest = (req: Request) => {
  if (req.cookies.refresh_token) return req.cookies.refresh_token as string;
  if (!isMobileClient(req)) return null;
  const authorization = req.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
};

const generateOtp = () =>
  otpGenerator.generate(OTP_LENGTH, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
    digits: true,
  });

async function isPendingDirectCandidate(user: IUser | null) {
  if (
    !user ||
    user.status !== UserStatus.PENDING ||
    user.emailVerifiedAt ||
    user.emailVerified
  ) return false;
  return Boolean(await runWithCompany(null, () => Application.exists({
    userId: user._id,
    source: ApplicationSource.DIRECT,
  })));
}

const organizationTitle = (level?: string, department?: string) => {
  if (level === "CEO") return "CEO";
  if (!level) return null;
  const label = department ? `${department.charAt(0)}${department.slice(1).toLowerCase()}` : "Organization";
  return `${label} ${level.charAt(0)}${level.slice(1).toLowerCase()}`;
};

const salesDesignation = (level?: OrganizationLevel) => {
  if (level === OrganizationLevel.HEAD) return SalesDesignation.HEAD;
  if (level === OrganizationLevel.MANAGER) return SalesDesignation.MANAGER;
  if (level === OrganizationLevel.MEMBER) return SalesDesignation.EXECUTIVE;
  return null;
};

/** Shape returned to the client — never includes password/token fields. */
const buildSafeUser = async (user: IUser, requestedCompanyId?: unknown) => {
  const { scope, company } = await resolveUserCompany(user, requestedCompanyId);
  const [assignment, roleContext] = await runWithCompany(scope, () => Promise.all([
    OrganizationAssignment.findOne({ userId: user._id, active: true })
      .select("level department designation employmentType roleKeys")
      .lean(),
    resolveCompanyRoleContext(String(user._id), user.roles, user.companyId ? String(user.companyId) : null),
  ]));
  const effectiveRoles = normalizeRoles(roleContext.roles);
  const systemRoleAssignments = await SystemRoleAssignment.find({ userId: user._id, roleType: "SYSTEM", active: true }).select("systemRole").lean();
  const systemRoles = systemRoleAssignments.map((assignment) => assignment.systemRole);
  const hasAssignedCompany = await hasOtherCompanyAssignment(user._id, user.companyId);
  const isLegacyCeo = !assignment && effectiveRoles.includes(UserRole.CEO);
  const isSalesAssignment = assignment?.department === OrganizationDepartment.SALES;
  return {
    user_id: user._id,
    user_name: user.name,
    user_email: user.email,
    user_dp: user.profile_pic ?? "",
    user_about: user.about,
    roles: effectiveRoles,
    permissions: [...new Set([...roleContext.permissionRoles.flatMap((role) => ROLE_PERMISSIONS[role as UserRole] ?? []), ...roleContext.permissions])],
    system_roles: systemRoles,
    organization_role_keys: assignment?.roleKeys ?? [],
    status: user.status,
    phone_number: user.phoneNumber ?? null,
    email_verified_at: user.emailVerifiedAt,
    created_at: user.createdAt,
    organization_level: assignment?.level ?? (isLegacyCeo ? "CEO" : null),
    organization_department: assignment?.department ?? null,
    organization_designation: assignment?.designation ?? (isSalesAssignment ? salesDesignation(assignment.level) : null),
    employment_type: assignment?.employmentType ?? (
      isSalesAssignment && assignment.level === OrganizationLevel.MEMBER
        ? effectiveRoles.includes(UserRole.INTERN) ? EmploymentType.INTERN : EmploymentType.EMPLOYEE
        : null
    ),
    organization_title: organizationTitle(assignment?.level ?? (isLegacyCeo ? "CEO" : undefined), assignment?.department),
    company: companyView(company),
    can_switch_company: isGroupExecutive(user) || systemRoles.includes("HR") || hasAssignedCompany,
    can_create_company: isGroupExecutive(user) || systemRoles.includes("HR"),
    can_view_company_admin_pages: user.roles.includes(UserRole.ADMIN),
  };
};

/** Issues access/refresh tokens, persists the session, and sets the refresh cookie. */
const issueSession = async (user: IUser, res: Response) => {
  const requestedCompanyId = res.req.headers["x-company-id"];
  const access_token = await createAccessToken(user._id, user.name, user.email);
  const refresh_token = await createRefreshToken(user._id, user.name, user.email);
  const hashed_refresh_token = hashToken(refresh_token);

  await Session.create({
    userId: user._id,
    name: user.name,
    email: user.email,
    tokenHash: hashed_refresh_token,
  });

  res.cookie("refresh_token", refresh_token, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return { access_token, refresh_token, safeUser: await buildSafeUser(user, requestedCompanyId) };
};

// send_otp — delivers a signup verification code. Never creates a User.
export const sendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: VerifyEmailDto = req.body;

    const existingUser = await User.findOne({ email: input.email });
    const invitedCandidate = await isPendingDirectCandidate(existingUser);
    if (existingUser && !invitedCandidate) {
      throw new ApiError(400, "An account with this email already exists. Please sign in.");
    }

    const otp = generateOtp();

    await OTP.findOneAndUpdate(
      { email: input.email },
      {
        email: input.email,
        otpHash: otpStorageValue(otp),
        purpose: OtpPurpose.SIGNUP_EMAIL_VERIFICATION,
        subjectId: invitedCandidate && existingUser ? existingUser._id : null,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    await sendVerificationCodeEmail(input.email, invitedCandidate && existingUser ? existingUser.name : "there", otp);

    return res.status(201).json({
      success: true,
      message: "Otp sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body as { email: string };
    const user = await User.findOne({ email, status: UserStatus.ACTIVE }).select("name email");
    if (user) {
      const otp = generateOtp();
      await OTP.findOneAndUpdate(
        { email },
        {
          email,
          otpHash: otpStorageValue(otp),
          purpose: OtpPurpose.PASSWORD_RESET,
          subjectId: user._id,
          attempts: 0,
          expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      try {
        await sendEmail(email, "Reset your Ricoz password", otp);
      } catch (error) {
        console.error("Password reset email delivery failed", error);
      }
    }
    return res.status(200).json({
      success: true,
      message: "If an active account exists for that email, a password reset code has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = req.body as ResetPasswordDto;
    const otpDoc = await OTP.findOne({
      email: input.email,
      purpose: OtpPurpose.PASSWORD_RESET,
    });
    if (!otpDoc) throw new ApiError(400, "Reset code is invalid or expired");
    if (otpDoc.expiresAt <= new Date()) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(400, "Reset code is invalid or expired");
    }
    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(400, "Too many attempts. Request a new reset code.");
    }
    if (!otpMatches(otpDoc.otpHash, input.otp)) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      throw new ApiError(400, "Reset code is invalid or expired");
    }

    const user = await User.findOne({ email: input.email, status: UserStatus.ACTIVE }).select("+password");
    if (!user || (otpDoc.subjectId && String(otpDoc.subjectId) !== String(user._id))) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(400, "Reset code is invalid or expired");
    }
    user.password = await bcrypt.hash(input.newPassword, 10);
    await user.save();
    await Promise.all([
      Session.deleteMany({ userId: user._id }),
      OTP.deleteOne({ _id: otpDoc._id }),
    ]);
    return res.json({ success: true, message: "Password reset successfully. Sign in with your new password." });
  } catch (error) {
    next(error);
  }
};

// signup — validates the OTP and creates the User in one step.
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: RegisterDto = req.body;

    const existingUser = await User.findOne({ email: input.email });
    const invitedCandidate = await isPendingDirectCandidate(existingUser);
    if (existingUser && !invitedCandidate) {
      throw new ApiError(400, "An account with this email already exists. Please sign in.");
    }

    const otpDoc = await OTP.findOne({
      email: input.email,
      purpose: OtpPurpose.SIGNUP_EMAIL_VERIFICATION,
    });
    if (!otpDoc) {
      throw new ApiError(400, "Verification code not found. Please request a new one.");
    }
    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(400, "Too many invalid attempts. Please request a new verification code.");
    }
    if (
      invitedCandidate &&
      (!existingUser || !otpDoc.subjectId || String(otpDoc.subjectId) !== String(existingUser._id))
    ) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(400, "Verification code is invalid or expired.");
    }
    if (!otpMatches(otpDoc.otpHash, input.otp)) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      throw new ApiError(400, "Invalid or expired verification code.");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    if (invitedCandidate && existingUser) {
      existingUser.password = hashedPassword;
      existingUser.name = input.name;
      existingUser.status = UserStatus.ACTIVE;
      existingUser.emailVerifiedAt = new Date();
      existingUser.emailVerified = true;
      await existingUser.save();
      await OTP.deleteOne({ _id: otpDoc._id });
      const session = await issueSession(existingUser, res);
      return res.status(200).json({
        success: true,
        accountActivated: true,
        access_token: session.access_token,
        user: session.safeUser,
      });
    }
    const profile_pic = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.name)}`;
    const requestedCompanyId = req.headers["x-company-id"];
    const signupCompany = typeof requestedCompanyId === "string" && /^[a-f\d]{24}$/i.test(requestedCompanyId)
      ? await Company.findOne({ _id: requestedCompanyId, active: true }).select("_id").lean()
      : null;

    const user = await User.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      profile_pic,
      roles: [UserRole.USER],
      status: UserStatus.PENDING,
      emailVerifiedAt: new Date(),
      ...(signupCompany ? { companyId: signupCompany._id } : {}),
    });

    await OTP.deleteOne({ _id: otpDoc._id });

    return res.status(201).json({
      success: true,
      onboardingPending: true,
      message: "Your profile was submitted for organization review.",
    });
  } catch (error) {
    next(error);
  }
};

export const currentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    return res.status(200).json({
      success: true,
      user: await buildSafeUser(req.authUser as IUser, req.headers["x-company-id"]),
    });
  } catch (error) {
    next(error);
  }
};

// login
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // fetch data
    const input: LoginDto = req.body;

    // isUser exists
    const isUser = await User.findOne({ email: input.email }).select("+password");
    if (!isUser) {
      throw new ApiError(404, "User not found, Please signup first");
    }
    // password validation
    if (!(await bcrypt.compare(input.password, isUser.password))) {
      throw new ApiError(400, "Incorrect Password");
    }

    const isEmailVerified = Boolean(isUser.emailVerifiedAt ?? isUser.emailVerified);
    if (!isEmailVerified) {
      throw new ApiError(403, "Please verify your email before signing in");
    }

    if (isUser.status && isUser.status !== UserStatus.ACTIVE) {
      throw new ApiError(403, "Account is not active");
    }
    await expireWorkRoles(isUser);
    if (!isUser.emailVerifiedAt) isUser.emailVerifiedAt = new Date();
    if (!isUser.status) isUser.status = UserStatus.ACTIVE;
    isUser.roles = normalizeRoles(isUser.roles);

    const { access_token, refresh_token, safeUser } = await issueSession(isUser, res);

    // return res
    return res.status(200).json({
      success: true,
      message: "LoggedIn",
      access_token,
      ...(isMobileClient(req) ? { refresh_token } : {}),
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

// refresh
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // fetch refresh_token
    const refresh_token = refreshTokenFromRequest(req);
    if (!refresh_token) {
      throw new ApiError(400, "Refresh Token Not Found");
    }

    const hashed_Refresh_token = hashToken(refresh_token);

    // fetch session
    const session = await Session.findOne({ tokenHash: hashed_Refresh_token });
    if (!session) {
      res.clearCookie("refresh_token", REFRESH_COOKIE_OPTIONS);
      throw new ApiError(400, "Session not found");
    }

    // isUser
    const isUser = await User.findById(session.userId);
    if (!isUser) {
      res.clearCookie("refresh_token", REFRESH_COOKIE_OPTIONS);
      throw new ApiError(400, "User not Found");
    }

    if (!isUser.emailVerifiedAt || isUser.status !== UserStatus.ACTIVE) {
      res.clearCookie("refresh_token", REFRESH_COOKIE_OPTIONS);
      throw new ApiError(403, "Account is not active");
    }
    isUser.roles = normalizeRoles(isUser.roles);
    await expireWorkRoles(isUser);

    // delete old session
    await Session.deleteOne({ tokenHash: hashed_Refresh_token });

    const { access_token, refresh_token: nextRefreshToken, safeUser } = await issueSession(isUser, res);

    // return res
    return res.status(200).json({
      success: true,
      message: "Refresh successfully",
      access_token,
      ...(isMobileClient(req) ? { refresh_token: nextRefreshToken } : {}),
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

// logout
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refresh_token = refreshTokenFromRequest(req);
    if (refresh_token) {
      const hashedRefreshToken = hashToken(refresh_token);
      await Session.deleteOne({ tokenHash: hashedRefreshToken });
    }

    res.clearCookie("refresh_token", REFRESH_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// update-profile — only self-editable identity fields, never roles/status/verification.
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: UpdateProfileDto = req.body;
    const user = await User.findById(req.authUser!._id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (input.name !== undefined) user.name = input.name;
    if (input.phoneNumber !== undefined) user.phoneNumber = input.phoneNumber;
    if (input.about !== undefined) user.about = input.about;
    if (input.profile_pic !== undefined) user.profile_pic = input.profile_pic;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: await buildSafeUser(user, req.headers["x-company-id"]),
    });
  } catch (error) {
    next(error);
  }
};

// change-password — revokes all sessions for safety, then re-authenticates this device.
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: ChangePasswordDto = req.body;
    const user = await User.findById(req.authUser!._id).select("+password");
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (!(await bcrypt.compare(input.currentPassword, user.password))) {
      throw new ApiError(400, "Current password is incorrect");
    }

    user.password = await bcrypt.hash(input.newPassword, 10);
    await user.save();
    await Session.deleteMany({ userId: user._id });

    const { access_token, refresh_token, safeUser } = await issueSession(user, res);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
      access_token,
      ...(isMobileClient(req) ? { refresh_token } : {}),
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

// list-sessions — reveals device/session metadata only, never token values.
export const listSessions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const currentRefreshToken = req.cookies.refresh_token;
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    const sessions = await Session.find({ userId: req.authUser!._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      sessions: sessions.map((session) => ({
        id: session._id,
        created_at: session.createdAt,
        current: session.tokenHash === currentHash,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// revoke-session — a user may only revoke their own sessions.
export const revokeSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session || String(session.userId) !== String(req.authUser!._id)) {
      throw new ApiError(404, "Session not found");
    }

    await Session.deleteOne({ _id: session._id });

    return res.status(200).json({
      success: true,
      message: "Session revoked",
    });
  } catch (error) {
    next(error);
  }
};

// logout-all — revokes every session for this account, including the current device.
export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await Session.deleteMany({ userId: req.authUser!._id });
    res.clearCookie("refresh_token", REFRESH_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "Logged out of all devices",
    });
  } catch (error) {
    next(error);
  }
};
