import { getUser } from "@/lib/auth/server";
import { bearer, noStore } from "@/lib/auth/http";

// Confirms a stored browser session is still valid and returns the current user.
export async function GET(request: Request) {
  const { data, error } = await getUser(bearer(request));
  if (error || !data.user) return Response.json({ error: error || { message: "Sign in again.", status: 401 } }, { status: error?.status || 401, headers: noStore });
  return Response.json({ user: data.user }, { headers: noStore });
}
