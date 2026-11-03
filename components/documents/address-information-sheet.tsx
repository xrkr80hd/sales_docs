"use client";

import {
  getCustomerDisplayName,
  type WorkflowData,
} from "@/lib/walker-workflow";

import styles from "./address-information.module.css";

type AddressInformationSheetProps = {
  workflow: WorkflowData;
};

function blockEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") { e.preventDefault(); }
}

export function AddressInformationSheet({
  workflow,
}: AddressInformationSheetProps) {
  return (
    <main
      className={styles.sheet}
      aria-label="Address Information Sheet form"
      data-print-sheet="address-information"
      style={{ position: "relative" }}
    >
      <h1 className={styles.docTitle}>Address Information Sheet</h1>

      <h2 className={styles.sectionTitle}>Physical Address:</h2>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Name</span>
        <div className={styles.fieldLine}>
          {getCustomerDisplayName(workflow)}
        </div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Street Address</span>
        <div className={styles.fieldLine}>{workflow.homeAddress}</div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>City, State, Zip Code</span>
        <div className={styles.fieldLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>{[workflow.homeCity, workflow.homeState].filter(Boolean).join(", ")}{workflow.homeZip ? ` ${workflow.homeZip}` : ""}</div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>County (Lease only)</span>
        <div className={styles.fieldLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
      </div>

      <div className={styles.spacerLg} />

      <h2 className={styles.sectionTitle}>Mailing Address:</h2>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Name</span>
        <div className={styles.fieldLine}>
          {workflow.mailingDifferent ? getCustomerDisplayName(workflow) : ""}
        </div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Address</span>
        <div className={styles.fieldLine}>{workflow.mailingAddress}</div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>City, State, Zip Code</span>
        <div className={styles.fieldLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>{[workflow.mailingCity, workflow.mailingState].filter(Boolean).join(", ")}{workflow.mailingZip ? ` ${workflow.mailingZip}` : ""}</div>
      </div>
      <span style={{ position: "absolute", bottom: 4, right: 8, fontSize: 7, color: "#bbb" }}>v1.0 • Address Info</span>
    </main>
  );
}
