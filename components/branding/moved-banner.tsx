/* Shown on every page of the old site: NextDocs now lives at nextdox.app. */
export function MovedBanner() {
  return <div role="region" aria-label="NextDocs has moved" style={{ position: "sticky", top: 0, zIndex: 1000, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "10px 16px", padding: "10px 16px", background: "linear-gradient(90deg, #851014, #be1717)", color: "#fff", fontWeight: 800, fontSize: 15, textAlign: "center", boxShadow: "0 4px 18px rgba(0,0,0,.35)" }}>
    <span>NextDocs has moved to its new home: <strong>nextdox.app</strong></span>
    <a href="https://nextdox.app" style={{ display: "inline-flex", alignItems: "center", minHeight: 36, padding: "6px 16px", borderRadius: 10, background: "#fff", color: "#851014", fontWeight: 900, textDecoration: "none" }}>Go to nextdox.app →</a>
  </div>;
}
