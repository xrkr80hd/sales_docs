"use client";

import { useEffect, useRef } from "react";

import {
  ACCOUNTING_LEFT_FIELDS,
  ACCOUNTING_RIGHT_FIELDS,
  CHECKLIST_ITEMS,
  cleanSingleLine,
  DELIVERY_CHECKLIST_ENTRY_FIELDS,
  formatDate,
  getCustomerDisplayName,
  getFullStockNumber,
  getLast8,
  normalizeVin,
  type DeliveryChecklistNoteKey,
  type DeliveryChecklistNotes,
  type WorkflowData,
} from "@/lib/walker-workflow";

import { type ConsultantInfo } from "@/lib/dealer-consultant";

import styles from "./delivery-checklist.module.css";

type EditableLineProps = {
  ariaLabel: string;
  className: string;
  fieldKey?: DeliveryChecklistNoteKey;
  notes: DeliveryChecklistNotes;
  onNoteChange?: (fieldKey: DeliveryChecklistNoteKey, value: string) => void;
};

function EditableLine({
  ariaLabel,
  className,
  fieldKey,
  notes,
  onNoteChange,
}: EditableLineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const value = fieldKey ? notes[fieldKey] || "" : "";

  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      className={`${className} ${fieldKey && onNoteChange ? styles.editable : ""}`}
      contentEditable={Boolean(fieldKey && onNoteChange)}
      suppressContentEditableWarning
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
      onBeforeInput={(event) => {
        if (
          event.nativeEvent instanceof InputEvent &&
          (event.nativeEvent.inputType === "insertParagraph" ||
            event.nativeEvent.inputType === "insertLineBreak")
        ) {
          event.preventDefault();
        }
      }}
      onInput={(event) => {
        const next = cleanSingleLine(event.currentTarget.textContent);
        if (next !== event.currentTarget.textContent) {
          event.currentTarget.textContent = next;
        }
      }}
      onBlur={(event) => {
        if (!fieldKey || !onNoteChange) {
          return;
        }
        onNoteChange(fieldKey, cleanSingleLine(event.currentTarget.textContent));
      }}
    />
  );
}

type DeliveryChecklistSheetProps = {
  consultant?: ConsultantInfo;
  notes: DeliveryChecklistNotes;
  onNoteChange?: (fieldKey: DeliveryChecklistNoteKey, value: string) => void;
  workflow: WorkflowData;
};

export function DeliveryChecklistSheet({
  consultant,
  notes,
  onNoteChange,
  workflow,
}: DeliveryChecklistSheetProps) {
  return (
    <main
      className={styles.sheet}
      aria-label="Delivery Checklist form"
      data-print-sheet="delivery-checklist"
      style={{ position: "relative" }}
    >
      <section className={styles.frame} aria-label="Delivery checklist content">
        <div className={`${styles.fieldRow} ${styles.fieldRowLarge} ${styles.dateRow}`}>
          <div className={styles.fieldLabel}>DATE:</div>
          <div className={`${styles.fieldLine} ${styles.fieldLineLg}`}>
            {formatDate(workflow.dealDate)}
          </div>
        </div>

        <div className={styles.spacerMd} />
        <h1 className={styles.docTitle}>Delivery Checklist</h1>
        <div className={styles.spacerMd} />

        <div className={styles.headerStack} aria-label="Delivery checklist header fields">
          <div className={styles.headerLine}>
            <div className={styles.headerLabel}>CUSTOMER:</div>
            <div className={`${styles.headerFill} ${styles.headerFillCustomer}`}>
              {getCustomerDisplayName(workflow)}
            </div>
            <div className={styles.headerGap} />
            <div className={styles.headerLabel}>SALESPERSON:</div>
            <div className={`${styles.headerFill} ${styles.headerFillSalesperson}`}>
              {consultant?.name || workflow.salespersonName}
            </div>
            <div className={styles.headerLabel}>#</div>
            <div className={`${styles.headerFill} ${styles.headerFillNumber}`}>
              {consultant?.salespersonNumber || workflow.salespersonNumber}
            </div>
          </div>

          <div className={styles.headerLine}>
            <div className={styles.headerLabel}>DEAL#:</div>
            <div className={`${styles.headerFill} ${styles.headerFillDeal}`}>
              {workflow.dealNumber}
            </div>
            <div className={styles.headerLabel}>STOCK#:</div>
            <div className={`${styles.headerFill} ${styles.headerFillStock}`}>
              {getFullStockNumber(workflow)}
            </div>
            <div className={styles.headerLabel}>EMAIL:</div>
            <div className={`${styles.headerFill} ${styles.headerFillEmail}`}>
              {workflow.email}
            </div>
          </div>

          <div className={styles.headerLine}>
            <div className={styles.headerLabel}>LAST 8:</div>
            <div className={`${styles.headerFill} ${styles.headerFillLast8}`}>
              {getLast8(workflow.vin)}
            </div>
            <div className={styles.headerLabel}>CUSTOMER SOURCE:</div>
            <div className={`${styles.headerFill} ${styles.headerFillSource}`}>
              {workflow.customerSource}
            </div>
          </div>
        </div>

        <div className={styles.spacerMd} />

        <div className={styles.checkGrid} aria-label="Delivery checklist items">
          <div className={styles.lineList}>
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item.key} className={styles.lineItem}>
                <div
                  className={`${styles.fillLine} ${workflow.deliveryChecklist[item.key] ? styles.isChecked : ""
                    }`}
                />
                <span>{item.label}</span>
                {item.key === "miles" && (
                  <span className={styles.lineItemValue} contentEditable suppressContentEditableWarning>{workflow.mileage}</span>
                )}
                {item.key === "etchNumbers" && (
                  <span className={styles.lineItemValue} contentEditable suppressContentEditableWarning>{workflow.etchNumbers}</span>
                )}
              </div>
            ))}
            <div className={styles.lineItem}>
              <div className={styles.fillLine}>
                {workflow.specialtyPlate === "yes" ? "Specialty" : workflow.specialtyPlate === "no" ? "Standard" : ""}
              </div>
              <span>Plate</span>
            </div>
          </div>

          <div className={styles.entryList}>
            {DELIVERY_CHECKLIST_ENTRY_FIELDS.map((field) => (
              <div key={field.id} className={styles.entryItem}>
                <span className={styles.entryLabel}>{field.label}</span>
                {field.id === "taxWatch" ? (
                  <>
                    <div className={styles.taxBox}>
                      {workflow.taxPercent}
                    </div>
                    <span className={styles.entryLabel}>%</span>
                  </>
                ) : field.id === "signedBuyerAgreement" ? (
                  <div className={styles.entryLine}>
                    {workflow.signedBuyerAgreement ? "✓" : ""}
                  </div>
                ) : field.id === "factoryInvFederalBuyerGuide" ? (
                  <div className={styles.entryLine}>
                    {workflow.factoryInvBuyerGuide ? "✓" : ""}
                  </div>
                ) : field.id === "firstServiceVisit" ? (
                  <div
                    className={styles.entryLine}
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {formatDate(workflow.firstServiceVisitDate)}
                  </div>
                ) : field.id === "deliveryChecklistNew" ? (
                  <div className={styles.entryLine}>
                    {workflow.dealType === "new" ? "New" : workflow.dealType === "used" ? "Used" : ""}
                  </div>
                ) : (
                  <EditableLine
                    ariaLabel={field.label}
                    className={styles.entryLine}
                    fieldKey={field.id}
                    notes={notes}
                    onNoteChange={onNoteChange}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.spacerSm} />
        <h2 className={styles.sectionHeading}>Trade Information</h2>
        <div className={styles.spacerSm} />

        <div className={styles.grid2}>
          <div className={styles.stackedLines}>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={`${styles.fieldLine} ${styles.fieldLineMd}`}>
                {[workflow.tradeYear, workflow.tradeMake, workflow.tradeModel].filter(Boolean).join(" ")}
              </div>
              <div>Year, Make, Model</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={`${styles.fieldLine} ${styles.fieldLineMd}`}>
                {normalizeVin(workflow.tradeVin)}
              </div>
              <div>VIN/Serial Number</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <EditableLine
                ariaLabel="Title to Trade"
                className={`${styles.fieldLine} ${styles.fieldLineSm}`}
                fieldKey="titleToTrade"
                notes={notes}
                onNoteChange={onNoteChange}
              />
              <div>Title to Trade</div>
            </div>
          </div>
          <div className={styles.stackedLines}>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <EditableLine
                ariaLabel="Current Registration"
                className={`${styles.fieldLine} ${styles.fieldLineSm}`}
                fieldKey="currentRegistration"
                notes={notes}
                onNoteChange={onNoteChange}
              />
              <div>Current Registration.</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <EditableLine
                ariaLabel="ACV Appraisal Form"
                className={`${styles.fieldLine} ${styles.fieldLineSm}`}
                fieldKey="acvAppraisalForm"
                notes={notes}
                onNoteChange={onNoteChange}
              />
              <div>ACV/Appraisal Form</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={`${styles.fieldLine} ${styles.fieldLineSm}`}>
                {[workflow.tradeColor, workflow.tradeMileage].filter(Boolean).join(" / ")}
              </div>
              <div>Color/Miles</div>
            </div>
          </div>
        </div>

        <div className={styles.spacerSm} />

        <div className={`${styles.grid2} ${styles.grid2Contact}`}>
          <div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>LIENHOLDER:</div>
              <div className={styles.fieldLine}>{workflow.lienholderName}</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>PHYSICAL ADDRESS:</div>
              <div className={styles.fieldLine}>{workflow.lienholderAddress}</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <EditableLine
                ariaLabel="Physical address line 2"
                className={styles.fieldLine}
                fieldKey="physicalAddressLine2"
                notes={notes}
                onNoteChange={onNoteChange}
              />
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>PHONE NUMBER:</div>
              <div className={styles.fieldLine}>{workflow.lienholderPhone}</div>
            </div>
          </div>
          <div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>ACCOUNT NUMBER:</div>
              <div className={styles.fieldLine}>{workflow.accountNumber}</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>PAYOFF AMOUNT:</div>
              <div className={styles.fieldLine}>{workflow.payoff15Day}</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>GOOD UNTIL:</div>
              <div className={styles.fieldLine}>{formatDate(workflow.goodUntilDate)}</div>
            </div>
            <div className={`${styles.fieldRow} ${styles.fieldRowCompact}`}>
              <div className={styles.fieldLabel}>SPOKE TO:</div>
              <div className={styles.fieldLine}>{workflow.representativeName}</div>
            </div>
          </div>
        </div>

        <div className={styles.spacerSm} />
        <h2 className={styles.sectionHeading}>For Account Use Only:</h2>
        <div className={styles.spacerSm} />

        <div className={`${styles.fieldRow} ${styles.fieldRowCompact} ${styles.officeDate}`}>
          <div className={`${styles.fieldLabel} ${styles.fieldLabelRegular}`}>
            Date Received in Office:
          </div>
          <EditableLine
            ariaLabel="Date received in office"
            className={styles.fieldLine}
            fieldKey="dateReceivedInOffice"
            notes={notes}
            onNoteChange={onNoteChange}
          />
        </div>

        <div className={styles.spacerSm} />

        <div className={styles.grid2}>
          <div className={styles.lineList}>
            {ACCOUNTING_LEFT_FIELDS.map((fieldKey, index) => {
              const labels = [
                "Down payment Posted in Accounting",
                "After Market Products",
                "Payoff Check Cut",
                "Tracking Number for Payoff Check in Folder",
                "Cancellations",
                "Funding Sent",
                "Finalized Deal in Accounting",
              ];

              return (
                <div key={fieldKey} className={styles.lineItem}>
                  <EditableLine
                    ariaLabel={labels[index]}
                    className={styles.fillLine}
                    fieldKey={fieldKey}
                    notes={notes}
                    onNoteChange={onNoteChange}
                  />
                  <span>{labels[index]}</span>
                </div>
              );
            })}
          </div>
          <div className={styles.lineList}>
            {ACCOUNTING_RIGHT_FIELDS.map((fieldKey, index) => {
              const labels = [
                "Title Work Sheet",
                "Received Trade Title",
                "Trade Title Paperwork Sent",
                "Received plate/Registration.",
                "Logged in Spreadsheet.",
              ];

              return (
                <div key={fieldKey} className={styles.lineItem}>
                  <EditableLine
                    ariaLabel={labels[index]}
                    className={styles.fillLine}
                    fieldKey={fieldKey}
                    notes={notes}
                    onNoteChange={onNoteChange}
                  />
                  <span>{labels[index]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <span style={{ position: "absolute", bottom: 4, right: 8, fontSize: 7, color: "#bbb" }}>v1.0 • Delivery Checklist</span>
    </main>
  );
}
