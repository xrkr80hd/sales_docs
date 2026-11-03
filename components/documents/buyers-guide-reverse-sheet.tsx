"use client";

import type { ConsultantInfo, DealerInfo } from "@/lib/dealer-consultant";
import { getDealerFullAddress } from "@/lib/dealer-consultant";
import type { WorkflowData } from "@/lib/walker-workflow";

import styles from "./buyers-guide-reverse.module.css";

type BuyersGuideReverseSheetProps = {
  workflow: WorkflowData;
  dealer?: DealerInfo;
  consultant?: ConsultantInfo;
};

const DEFECTS_COL1 = [
  {
    heading: "Frame & Body", items: [
      "Frame—cracks, corrective welds, or rusted through",
      "Dog tracking—bent or twisted frame",
      "Body Panels—rusted through",
    ]
  },
  {
    heading: "Engine", items: [
      "Oil leakage, excluding normal seepage",
      "Cracked block or head",
      "Belts missing or inoperable",
      "Knocks or misses related to camshaft,",
      "  crankshaft, or connecting rods",
      "Abnormal exhaust discharge",
    ]
  },
  {
    heading: "Transmission & Drive Shaft", items: [
      "Improper shifting or functioning in any gear",
      "Abnormal noise or vibration caused by faulty",
      "  transmission or drive shaft",
    ]
  },
  {
    heading: "Differential", items: [
      "Improper fluid level or leakage, excluding",
      "  normal seepage",
      "Cracked or damaged case which is visible",
      "Abnormal noise or vibration caused by faulty",
      "  differential",
    ]
  },
];

const DEFECTS_COL2 = [
  {
    heading: "Cooling System", items: [
      "Leakage including radiator",
      "Improperly functioning water pump",
    ]
  },
  {
    heading: "Electrical System", items: [
      "Battery, starter, generator",
      "Improperly functioning alternator, generator,",
      "  battery",
      "Battery leakage",
    ]
  },
  {
    heading: "Fuel System", items: [
      "Visible leakage",
    ]
  },
  {
    heading: "Inoperable Accessories", items: [
      "Gauges or warning devices",
      "Air conditioning",
      "Heater & Defroster",
    ]
  },
  {
    heading: "Brake System", items: [
      "Failure warning light broken",
      "Pedal not firm under pressure (DOT spec.)",
      "Not enough brake reserve (DOT spec.)",
      "Does not stop vehicle in straight line",
      "  (DOT spec.)",
    ]
  },
];

const DEFECTS_COL3 = [
  {
    heading: "Steering System", items: [
      "Too much free play at steering wheel",
      "Free play in linkage more than 1/4 inch",
      "Steering gear binds or jams",
      "Front wheels aligned improperly",
      "Power unit fluid level or leakage,",
      "  excluding normal seepage",
    ]
  },
  {
    heading: "Suspension System", items: [
      "Ball joint seals damaged",
      "Stabilizer bar disconnected",
      "Spring broken",
      "Shock absorber leaking or functioning",
      "  improperly",
      "Rubber bushings damaged or missing",
      "Radius rod damaged or missing",
      "Structural parts bent or damaged",
    ]
  },
  {
    heading: "Tires", items: [
      "Tread depth less than 2/32 inch",
      "Sizes mismatched",
      "Visible damage",
    ]
  },
  {
    heading: "Exhaust System", items: [
      "Leakage",
    ]
  },
  {
    heading: "", items: [
      "Mounting bolts loose or missing",
      "Exhaust system corroded, damaged or repairs",
      "Visible cracks, damage or missing",
      "Wheels—loss of, or damaged",
      "Springs broken",
      "Stabilizer bar disconnected",
      "Structural parts bent or damaged",
      "Suspension system damaged",
      "Ball joint seals damaged",
    ]
  },
];

export function BuyersGuideReverseSheet({
  dealer,
  consultant,
}: BuyersGuideReverseSheetProps) {
  const dealerContactName = [
    dealer?.dealershipName?.trim(),
    consultant?.name?.trim(),
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <main
      className={styles.sheet}
      aria-label="Buyers Guide Reverse form"
      data-print-sheet="buyers-guide-reverse"
      style={{ position: "relative" }}
    >
      <section className={styles.frame} aria-label="Buyers Guide Reverse content">
        {/* Defects section FIRST */}
        <p className={styles.defectTitle}>
          Here is a list of some major defects that may occur in used vehicles.
        </p>

        <div className={styles.threeCol}>
          <div>
            {DEFECTS_COL1.map((group) => (
              <div key={group.heading}>
                <p className={styles.defectColTitle}>{group.heading}</p>
                <ul className={styles.defectList}>
                  {group.items.map((item, i) => (
                    <li key={i} className={styles.defectItem}>{item}</li>
                  ))}
                </ul>
                <div className={styles.spacerMd} />
              </div>
            ))}
          </div>
          <div>
            {DEFECTS_COL2.map((group) => (
              <div key={group.heading}>
                <p className={styles.defectColTitle}>{group.heading}</p>
                <ul className={styles.defectList}>
                  {group.items.map((item, i) => (
                    <li key={i} className={styles.defectItem}>{item}</li>
                  ))}
                </ul>
                <div className={styles.spacerMd} />
              </div>
            ))}
          </div>
          <div>
            {DEFECTS_COL3.map((group, gi) => (
              <div key={group.heading || gi}>
                {group.heading && (
                  <p className={styles.defectColTitle}>{group.heading}</p>
                )}
                <ul className={styles.defectList}>
                  {group.items.map((item, i) => (
                    <li key={i} className={styles.defectItem}>{item}</li>
                  ))}
                </ul>
                <div className={styles.spacerMd} />
              </div>
            ))}
          </div>
        </div>

        {/* IMPORTANT notice SECOND */}
        <p className={styles.importantBlock}>
          <span className={styles.importantLabel}>IMPORTANT:</span> The
          information on this form is part of any contract to buy this vehicle.
          Removing this label before consumer purchase (except for purposes of
          test-driving) violates federal law (16 C.F.R. 455).
        </p>

        {/* Contact section LAST — restructured */}
        <div className={styles.contactSection}>
          <p className={styles.contactTitle}>
            For Complaints After Sale, Contact:
          </p>
          <div className={styles.contactGrid}>
            <div className={styles.contactCell}>
              <span className={styles.contactLabel}>Dealer Name</span>
              <div className={styles.contactLine}>{dealerContactName}</div>
            </div>
            <div className={styles.contactCell}>
              <span className={styles.contactLabel}>Address</span>
              <div className={styles.contactLine}>
                {dealer ? getDealerFullAddress(dealer) : ""}
              </div>
            </div>
            <div className={styles.contactCell}>
              <span className={styles.contactLabel}>Salesperson Phone</span>
              <div className={styles.contactLine}>{consultant?.phone}</div>
            </div>
            <div className={styles.contactCell}>
              <span className={styles.contactLabel}>Salesperson Email</span>
              <div className={styles.contactLine}>{consultant?.email}</div>
            </div>
          </div>
        </div>

        {/* Customer Signature & Date — bottom of back page */}
        <div className={styles.signatureBlock}>
          <div className={styles.signatureLine} />
          <p className={styles.signatureLabel}>Customer Signature &amp; Date</p>
        </div>
      </section>
      <span style={{ position: "absolute", bottom: 4, right: 8, fontSize: 7, color: "#bbb" }}>v1.0 • Buyers Guide (reverse)</span>
    </main>
  );
}
