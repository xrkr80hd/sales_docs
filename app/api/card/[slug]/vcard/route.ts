import { getPublishedConsultantProfile } from "@/lib/public-consultant-profile";

function escapeVCard(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const profile = await getPublishedConsultantProfile(slug);

  if (!profile) {
    return new Response("Consultant card not found", { status: 404 });
  }

  const { identity, content } = profile;
  const displayName = identity.displayName || "Sales Consultant";
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // Derive origin host for canonical digital business card URL
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const cardUrl = `${proto}://${host}/card/${slug}`;

  // Clean phone number for tel format
  const cleanPhone = identity.phone ? identity.phone.replace(/[^\d+]/g, "") : "";

  // Construct standards-compliant vCard 3.0
  const vcardLines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(displayName)}`,
    `N:${escapeVCard(lastName)};${escapeVCard(firstName)};;;`,
  ];

  if (identity.dealership) {
    vcardLines.push(`ORG:${escapeVCard(identity.dealership)}`);
  }

  if (identity.jobTitle) {
    vcardLines.push(`TITLE:${escapeVCard(identity.jobTitle)}`);
  }

  if (identity.phone) {
    vcardLines.push(`TEL;TYPE=CELL,VOICE,pref:${identity.phone}`);
    if (cleanPhone && cleanPhone !== identity.phone) {
      vcardLines.push(`X-TEL-CLEAN:${cleanPhone}`);
    }
  }

  if (identity.email) {
    vcardLines.push(`EMAIL;TYPE=INTERNET,pref:${identity.email}`);
  }

  vcardLines.push(`URL;TYPE=WORK:${cardUrl}`);

  if (identity.location) {
    vcardLines.push(`ADR;TYPE=WORK:;;;${escapeVCard(identity.location)};;;`);
  }

  const note = [content.primaryPhrase, content.salesQuote].filter(Boolean).join(" - ");
  if (note) {
    vcardLines.push(`NOTE:${escapeVCard(note)}`);
  }

  // End vCard
  vcardLines.push("END:VCARD");
  const vcardContent = vcardLines.join("\r\n");

  const sanitizedFilename = displayName.replace(/[^a-zA-Z0-9_-]/g, "_");

  return new Response(vcardContent, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sanitizedFilename}.vcf"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
