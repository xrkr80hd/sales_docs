import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedHosts = new Set([
  "www.walkercdjr.net",
  "walkercdjr.net",
  "www.walkerautomotive.com",
  "walkerautomotive.com",
]);

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .trim();
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return null;
}

function firstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].replace(/<[^>]*>/g, " "));
  }
  return null;
}

function normalizePrice(value: string | null) {
  if (!value) return null;
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "A Walker vehicle URL is required." }, { status: 400 });
  }

  let listingUrl: URL;
  try {
    listingUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "The vehicle URL is invalid." }, { status: 400 });
  }

  if (listingUrl.protocol !== "https:" || !allowedHosts.has(listingUrl.hostname.toLowerCase())) {
    return NextResponse.json(
      { error: "Only approved Walker Automotive listing links can be imported." },
      { status: 400 },
    );
  }

  listingUrl.search = "";
  listingUrl.hash = "";

  try {
    const response = await fetch(listingUrl, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; WalkerProfilePreview/1.0)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Walker returned ${response.status} for this listing.` },
        { status: 502 },
      );
    }

    const html = await response.text();
    const title =
      meta(html, "og:title") ||
      firstMatch(html, [/<h1[^>]*>([\s\S]*?)<\/h1>/i, /<title[^>]*>([\s\S]*?)<\/title>/i]);
    const imageUrl = meta(html, "og:image") || meta(html, "twitter:image");
    const description = meta(html, "og:description") || meta(html, "description");
    const vin = firstMatch(html, [
      /(?:VIN|vin)["'\s:=><-]+([A-HJ-NPR-Z0-9]{17})/i,
      /([A-HJ-NPR-Z0-9]{17})/,
    ]);
    const stock = firstMatch(html, [
      /(?:Stock|stock(?:Number|_number)?)[#"'\s:=><-]+([A-Z0-9-]{4,20})/i,
    ]);
    const priceValue =
      meta(html, "product:price:amount") ||
      firstMatch(html, [
        /(?:Walker Price|Sale Price|Internet Price)[\s\S]{0,180}?\$\s*([0-9,]+)/i,
        /"price"\s*:\s*"?([0-9,.]+)"?/i,
      ]);

    if (!title) {
      return NextResponse.json(
        { error: "The listing loaded, but its vehicle title could not be identified." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      sourceUrl: listingUrl.toString(),
      title,
      imageUrl,
      description,
      vin,
      stock,
      price: normalizePrice(priceValue),
      importedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error";
    return NextResponse.json({ error: `Unable to import this listing: ${message}` }, { status: 502 });
  }
}
