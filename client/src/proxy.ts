import { NextResponse } from "next/server";

export function proxy() {
  // The API owns the refresh cookie on another subdomain, so Vercel cannot inspect
  // it here. Auth is enforced by the API and the client refresh interceptor.
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
