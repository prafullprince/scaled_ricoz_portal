export type RegisterInput = {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    otp: string;
    designation?: string;
}

export type LoginInput = {
    email: string;
    password: string;
}

export type UpdateProfileInput = {
    name?: string;
    phoneNumber?: string;
    about?: string;
    profile_pic?: string;
}

export type ChangePasswordInput = {
    currentPassword: string;
    newPassword: string;
}
