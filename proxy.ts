import { NextRequest, NextResponse } from "next/server";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  guard: "/guard",
  contractor: "/contractor",
  approver: "/approver",
  user: "/dashboard",
};

const PATH_ROLES: [string, string][] = [
  ["/dashboard", "user"],
  ["/approver", "approver"],
  ["/admin", "admin"],
  ["/contractor", "contractor"],
  ["/guard", "guard"],
];

function getRoleForPath(pathname: string): string | null {
  for (const [path, role] of PATH_ROLES) {
    if (pathname === path || pathname.startsWith(path + "/")) return role;
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("userRole")?.value ?? null;
  const requiredRole = getRoleForPath(pathname);

  if (pathname === "/") {
    if (role && ROLE_HOME[role]) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (requiredRole) {
    if (!role) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (role !== requiredRole && role !== "admin") {
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/dashboard/:path*",
    "/approver",
    "/approver/:path*",
    "/admin",
    "/admin/:path*",
    "/contractor",
    "/contractor/:path*",
    "/guard",
    "/guard/:path*",
  ],
};
