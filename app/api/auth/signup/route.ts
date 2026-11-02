export async function POST() {
  return Response.json({ error: "Use the invitation link sent to your email, or ask your administrator to create your account." }, { status: 410 });
}
