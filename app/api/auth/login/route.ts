import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/server/db";
import { setAuthCookies, verifyPassword } from "../../../../lib/server/auth";
import { audit } from "../../../../lib/server/domain";
import { errorResponse } from "../../../../lib/server/http";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  guard: "/guard",
  contractor: "/contractor",
  approver: "/approver",
};

type LoginUser = {
  id: number;
  login: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  organization_name: string | null;
  password_hash: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const login = String(body.login ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }
    const result = await query<LoginUser>(
      `SELECT u.*, o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE (lower(u.login) = $1 OR lower(u.email) = $1) AND u.active = true
       LIMIT 1`,
      [login],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }
    await audit(queryClient, user.id, "auth.login", "user", user.id, {
      login: user.login,
      name: user.name,
      role: user.role,
      department: user.department,
      organization: user.organization_name,
    });
    const response = NextResponse.json({
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        organizationName: user.organization_name,
      },
      redirectTo: ROLE_HOME[user.role] ?? "/dashboard",
    });
    setAuthCookies(response, user);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

const queryClient = {
  query: (text: string, params?: unknown[]) => query(text, params),
};
