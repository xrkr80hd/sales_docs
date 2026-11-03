/** Which build is live. Open tabs compare this with the build they loaded (see UpdatePrompt). */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID || "" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
