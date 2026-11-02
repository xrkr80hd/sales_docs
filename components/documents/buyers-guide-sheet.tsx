"use client";

import {
  normalizeVin,
  type WorkflowData
} from "@/lib/walker-workflow";

import { useState } from "react";
import styles from "./buyers-guide.module.css";

type BuyersGuideSheetProps = {
  workflow: WorkflowData;
};

function blockEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") { e.preventDefault(); }
}

type BoxKey =
  | "implied"
  | "dealerWarranty"
  | "fullWarranty"
  | "limitedWarranty"
  | "mfgWarranty"
  | "mfgUsedWarranty"
  | "otherWarranty"
  | "serviceContract";

function Box({
  checked,
  lg,
  onToggle,
}: {
  checked: boolean;
  lg?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={lg ? styles.checkboxLg : styles.checkbox}
      onClick={onToggle}
      style={{ cursor: "pointer" }}
    >
      {checked ? "✕" : ""}
    </div>
  );
}

export function BuyersGuideSheet({ workflow }: BuyersGuideSheetProps) {
  const [checks, setChecks] = useState<Record<BoxKey, boolean>>({
    implied: false,
    dealerWarranty: false,
    fullWarranty: false,
    limitedWarranty: false,
    mfgWarranty: false,
    mfgUsedWarranty: false,
    otherWarranty: false,
    serviceContract: false,
  });

  function toggle(key: BoxKey) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <main
      className={styles.sheet}
      aria-label="Buyers Guide form"
      data-print-sheet="buyers-guide"
      style={{ position: "relative" }}
    >
      <section className={styles.frame} aria-label="Buyers Guide content">
        <h1 className={styles.docTitle}>Buyers Guide</h1>

        <div className={styles.solidLine} />

        <p className={styles.importantNote}>
          <span className={styles.importantLabel}>IMPORTANT:</span> Spoken
          promises are difficult to enforce. Ask the dealer to put all promises
          in writing. Keep this form.
        </p>

        <div className={styles.vehicleValuesRow}>
          <span className={styles.vehicleValue}>{workflow.vehicleMake}</span>
          <span className={styles.vehicleValue}>{workflow.vehicleModel}</span>
          <span className={styles.vehicleValue}>{workflow.vehicleYear}</span>
          <span className={styles.vehicleValue}>{normalizeVin(workflow.vin)}</span>
        </div>

        <div className={styles.solidLine} />

        <div className={styles.vehicleLabelRow}>
          <span className={styles.vehicleBarLabel}>Vehicle Make</span>
          <span className={styles.vehicleBarLabel}>Model</span>
          <span className={styles.vehicleBarLabel}>Year</span>
          <span className={styles.vehicleBarLabel}>Vehicle Identification Number (VIN)</span>
        </div>

        <div className={styles.spacerMd} />

        <h2 className={styles.warrantyTitle}>
          WARRANTIES FOR THIS VEHICLE:
        </h2>

        <div className={styles.boldLine} />

        <div className={styles.sectionRow}>
          <Box checked={checks.implied} lg onToggle={() => toggle("implied")} />
          <div>
            <p className={styles.impliedTitle}>AS IS - NO DEALER WARRANTY</p>
            <div className={styles.spacerSm} />
            <p className={styles.asIsSubtitle}>
              THE DEALER DOES NOT PROVIDE A WARRANTY FOR ANY REPAIRS AFTER SALE.
            </p>
          </div>
        </div>

        <div className={styles.dashedLine} />

        <div className={styles.sectionRow}>
          <Box checked={checks.dealerWarranty} lg onToggle={() => toggle("dealerWarranty")} />
          <div>
            <p className={styles.dealerWarrantyTitle}>Dealer Warranty</p>
            <div className={styles.spacerSm} />
            <div className={styles.warrantyCheckRow}>
              <Box checked={checks.fullWarranty} onToggle={() => toggle("fullWarranty")} />
              <span className={styles.warrantyCheckLabel}>FULL WARRANTY.</span>
            </div>
            <div className={styles.spacerSm} />
            <div className={styles.warrantyCheckRow}>
              <Box checked={checks.limitedWarranty} onToggle={() => toggle("limitedWarranty")} />
              <span className={styles.limitedWarrantyText}>
                LIMITED WARRANTY. The dealer will pay{" "}
                <span className={styles.fieldLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>&nbsp;&nbsp;&nbsp;&nbsp;</span>% of the labor and{" "}
                <span className={styles.fieldLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>&nbsp;&nbsp;&nbsp;&nbsp;</span>% of the parts for the covered systems
                that fail during the warranty period. Ask the dealer for a copy
                of the warranty, and for any documents that explain warranty
                coverage, exclusions, and the dealer&rsquo;s repair obligations.{" "}
                <em>Implied warranties</em> under your state&rsquo;s laws may
                give you additional rights.
              </span>
            </div>
          </div>
        </div>

        <div className={styles.spacerMd} />

        <div className={styles.twoCol}>
          <div>
            <p className={styles.systemsCoveredLabel}>Systems Covered:</p>
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
          </div>
          <div>
            <p className={styles.systemsCoveredLabel}>Duration:</p>
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <div className={styles.underlineFill} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
          </div>
        </div>

        <div className={styles.spacerMd} />

        <div className={styles.lowerSection}>
          <h3 className={styles.nonDealerTitle}>
            Non-Dealer Warranties For This Vehicle:
          </h3>

          <div className={styles.warrantyCheckRow}>
            <Box checked={checks.mfgWarranty} onToggle={() => toggle("mfgWarranty")} />
            <span className={styles.bodyText}>
              MANUFACTURER&rsquo;S WARRANTY STILL APPLIES. The
              manufacturer&rsquo;s original warranty has not expired on some
              components of the vehicle.
            </span>
          </div>

          <div className={styles.warrantyCheckRow}>
            <Box checked={checks.mfgUsedWarranty} onToggle={() => toggle("mfgUsedWarranty")} />
            <span className={styles.bodyText}>
              MANUFACTURER&rsquo;S USED VEHICLE WARRANTY APPLIES.
            </span>
          </div>

          <div className={styles.warrantyCheckRow}>
            <Box checked={checks.otherWarranty} onToggle={() => toggle("otherWarranty")} />
            <span className={styles.bodyText}>
              OTHER USED VEHICLE WARRANTY APPLIES.
            </span>
          </div>

          <p className={styles.bodyText}>
            Ask the dealer for a copy of the warranty document and an explanation
            of warranty coverage, exclusions, and repair obligations.
          </p>

          <div className={styles.warrantyCheckRow}>
            <Box checked={checks.serviceContract} onToggle={() => toggle("serviceContract")} />
            <span className={styles.bodyText}>
              SERVICE CONTRACT. A service contract on this vehicle is available for
              an extra charge. Ask for details about coverage, deductible, price,
              and exclusions. If you buy a service contract within 90 days of your
              purchase of this vehicle, <em>implied warranties</em> under your
              state&rsquo;s laws may give you additional rights.
            </span>
          </div>

          <div className={styles.solidLine} />

          <p className={styles.boldText}>
            ASK THE DEALER IF YOUR MECHANIC CAN INSPECT THE VEHICLE ON OR OFF THE
            LOT.
          </p>

          <p className={styles.bodyText}>
            <strong>OBTAIN A VEHICLE HISTORY REPORT AND CHECK FOR OPEN SAFETY RECALLS.</strong> For
            information on how to obtain a vehicle history report, visit
            ftc.gov/usedcars. To check for open safety recalls, visit
            safercar.gov. You will need the vehicle identification number (VIN)
            shown above to make the best use of the resources on these sites.
          </p>

          <p className={styles.seeOther}>
            SEE OTHER SIDE for important additional information, including a list
            of major defects that may occur in used motor vehicles.
          </p>

          <p className={styles.spanishNote}>
            Si el concesionario gestiona la venta en espa&ntilde;ol, p&iacute;dale
            una copia de la Gu&iacute;a del Comprador en espa&ntilde;ol.
          </p>

        </div>
      </section>
      <span style={{ position: "absolute", bottom: 4, right: 8, fontSize: 7, color: "#bbb" }}>v1.0 • Buyers Guide</span>
    </main>
  );
}
