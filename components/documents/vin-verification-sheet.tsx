"use client";

import type { ConsultantInfo } from "@/lib/dealer-consultant";
import {
  getFullStockNumber,
  type WorkflowData,
} from "@/lib/walker-workflow";
import css from "./vin-verification.module.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDealDate(value: string) {
  if (!value) return { day: "", month: "", year2: "" };
  const [y, m, d] = value.split("-");
  return {
    day: d ? String(Number(d)) : "",
    month: m ? MONTH_NAMES[Number(m) - 1] ?? "" : "",
    year2: y ? y.slice(-2) : "",
  };
}

interface Props {
  workflow: WorkflowData;
  consultant?: ConsultantInfo;
}

function blockEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") { e.preventDefault(); }
}

export function VinVerificationSheet({ workflow, consultant }: Props) {
  const dd = parseDealDate(workflow.dealDate);

  return (
    <div className={css.sheet} data-print-sheet="vin-verification" style={{ position: "relative" }}>
      <h1 className={css.docTitle}>VIN Verification</h1>

      <div className={css.spacerLg} />

      <p className={css.paragraph}>
        The vehicle referenced below bearing Stock #{" "}
        <span className={css.inlineField}>{getFullStockNumber(workflow)}</span> has been
        delivered to{" "}
        <span className={css.inlineFieldWide}>{workflow.customerName}</span> on the{" "}
        <span className={css.inlineFieldShort} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>{dd.day}</span> day of{" "}
        <span className={css.inlineField} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>{dd.month}</span> 20
        <span className={css.inlineFieldShort} contentEditable suppressContentEditableWarning onKeyDown={blockEnter}>{dd.year2}</span>.
        {workflow.coCustomerName ? (
          <><br /><span className={css.inlineFieldWide}>{workflow.coCustomerName}</span></>
        ) : null}
      </p>

      <div className={css.spacerMd} />

      <p className={css.paragraph}>
        A physical inspection of the vehicle has been performed and the VIN
        listed below has been verified by the undersigned as correct.
      </p>

      <div className={css.spacerLg} />

      {/* Vehicle Info */}
      <div className={css.vehicleRow}>
        <div className={css.vehicleCell}>
          <div className={css.vehicleLine}>{workflow.vehicleYear}</div>
          <span className={css.vehicleLabel}>Year</span>
        </div>
        <div className={css.vehicleCell}>
          <div className={css.vehicleLine}>{workflow.vehicleMake}</div>
          <span className={css.vehicleLabel}>Make</span>
        </div>
        <div className={css.vehicleCell}>
          <div className={css.vehicleLine}>{workflow.vehicleModel}</div>
          <span className={css.vehicleLabel}>Model</span>
        </div>
        <div className={css.vehicleCell}>
          <div className={css.vehicleLine}>{workflow.mileage}</div>
          <span className={css.vehicleLabel}>Mileage</span>
        </div>
      </div>

      {/* VIN */}
      <div className={css.vinRow}>
        <span className={css.vinLabel}>VIN Number</span>
        <span className={css.vinLine}>{workflow.vin}</span>
      </div>

      <div className={css.spacerLg} />

      {/* Customer Signature */}
      <div className={css.signatureBlock}>
        <div className={css.signatureLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
        <span className={css.signatureLabel}>Customer Signature</span>
      </div>

      <div className={css.printedNameBlock}>
        <div className={css.signatureLine}>{workflow.customerName}</div>
        <span className={css.signatureLabel}>Customer Printed Name</span>
      </div>

      {workflow.coCustomerName ? (
        <>
          <div className={css.signatureBlock}>
            <div className={css.signatureLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
            <span className={css.signatureLabel}>Co-Buyer Signature</span>
          </div>

          <div className={css.printedNameBlock}>
            <div className={css.signatureLine}>{workflow.coCustomerName}</div>
            <span className={css.signatureLabel}>Co-Buyer Printed Name</span>
          </div>
        </>
      ) : null}

      <div className={css.spacerLg} />

      {/* Salesperson Signature */}
      <div className={css.signatureBlock}>
        <div className={css.signatureLine} contentEditable suppressContentEditableWarning onKeyDown={blockEnter} />
        <span className={css.signatureLabel}>Salesperson Signature</span>
      </div>

      <div className={css.printedNameBlock}>
        <div className={css.signatureLine}>
          {consultant?.name}
        </div>
        <span className={css.signatureLabel}>Salesperson Printed Name</span>
      </div>
      <span style={{ position: "absolute", bottom: 4, right: 8, fontSize: 7, color: "#bbb" }}>v1.0 • VIN Verification</span>
    </div>
  );
}
