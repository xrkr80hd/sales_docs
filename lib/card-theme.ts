import { organizationThemeKey } from "@/lib/organization-theme";

/** Public card colors follow the consultant's dealership (red stays the default for Walker / CDJR and stores without their own set yet). */
export function cardThemeClass(styles: Record<string, string>, dealership = "") {
  const key = organizationThemeKey(dealership);
  if (key === "kia") return styles.themeKia || "";
  return "";
}
