export default function MessengerPage() {
  return (
    <main style={{ minHeight: "min(75dvh, 720px)", display: "grid", placeItems: "center", padding: "clamp(24px, 6vw, 64px)", background: "#0c0e12", color: "#fff", textAlign: "center" }}>
      <section style={{ maxWidth: 560, width: "100%", padding: "clamp(28px, 6vw, 56px)", border: "1px solid #333841", borderRadius: 24, background: "#171a20" }}>
        <div aria-hidden="true" style={{ marginBottom: 22, fontSize: 38 }}>💬</div>
        <p style={{ margin: "0 0 12px", color: "#ff4545", fontWeight: 800, letterSpacing: "0.16em", fontSize: 12 }}>NXT DOX MESSENGER</p>
        <h1 style={{ fontSize: "clamp(26px, 6vw, 42px)", lineHeight: 1.15, margin: "0 0 20px", fontWeight: 850 }}>Chat is Under Construction</h1>
        <p style={{ color: "#c8cbd1", fontSize: "clamp(15px, 3vw, 18px)", lineHeight: 1.65, margin: 0 }}>We're rebuilding the Messenger for a better, faster, mobile-friendly experience. Your existing conversations are being preserved. Please check back soon.</p>
      </section>
    </main>
  );
}
