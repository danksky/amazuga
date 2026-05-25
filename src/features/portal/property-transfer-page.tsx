"use client";

import Link from "next/link";
import { useState } from "react";

import { createOwnershipTransferAction } from "@/features/portal/actions";
import { formatCurrency } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { PortalOwnedPropertySummary } from "@/lib/server/portal-properties";
import type { PropertyTransferMode } from "@/types/domain";

import styles from "./property-transfer-page.module.css";

const IREMBO_TITLE_TRANSFER_FAQ_URL =
  "https://support.irembo.gov.rw/en/support/solutions/articles/47001221491-frequently-asked-questions-about-land-title-transfer";

function getTransferFeedbackTone(status: TransferFeedback["status"]) {
  return status === "buyer_not_found" || status === "self" || status === "not_owner"
    ? styles.feedbackWarning
    : styles.feedbackSuccess;
}

type TransferFeedback = {
  status: "created" | "existing_pending" | "buyer_not_found" | "self" | "not_owner";
  buyerEmail?: string;
};

export function PropertyTransferPage({
  feedback,
  property,
}: {
  feedback?: TransferFeedback;
  property: PortalOwnedPropertySummary;
}) {
  const [transferMode, setTransferMode] = useState<PropertyTransferMode | null>(null);
  const recipientLabel = transferMode === "sale" ? "Buyer email" : "Recipient email";
  const recipientPlaceholder = transferMode === "sale" ? "buyer@example.com" : "recipient@example.com";
  const transferTitle = transferMode === "sale" ? "Sell property" : transferMode === "transfer" ? "Transfer property" : "Transfer or sell property";
  const transferBody =
    transferMode === "sale"
      ? "Start a sale handoff for this property. The buyer must accept the request before admin can approve it."
      : transferMode === "transfer"
        ? "Start a direct ownership transfer for this property. The recipient must accept the request before admin can approve it."
        : "Choose whether this is a sale or a direct transfer first. The rest of the request will adapt to that choice.";
  const feedbackMessage =
    feedback?.status === "created"
      ? `Transfer request sent to ${feedback.buyerEmail || "the recipient"}. They still need to accept it before admin can approve it.`
      : feedback?.status === "existing_pending"
        ? "There is already an open transfer request for this property."
        : feedback?.status === "buyer_not_found"
          ? `No active Amazuga account exists yet for ${feedback.buyerEmail || "that email address"}.`
          : feedback?.status === "self"
            ? "You cannot transfer a property to yourself."
            : feedback?.status === "not_owner"
              ? "This transfer could not be created because the property is no longer owned by your account."
              : null;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Portal</div>
          <h1 className={styles.title}>{transferTitle}</h1>
          <div className={styles.body}>{transferBody}</div>
        </div>

        <div className={styles.actions}>
          <Link className={styles.secondaryAction} href={routes.app.portalProperties}>
            Back to properties
          </Link>
          <Link className={styles.secondaryAction} href={routes.public.property(property.propertyRouteId, property.propertyTitle)}>
            Open property page
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.propertyTitle}>{property.propertyTitle}</h2>
              <div className={styles.propertyMeta}>
                {property.sector ? `${property.sector}, ` : ""}
                {property.district}
              </div>
            </div>
            <div className={styles.badges}>
              <div className={styles.badge}>{property.ownershipScope === "unit" ? "Unit ownership" : "Full ownership"}</div>
              <div className={styles.badge}>Property ID {property.propertyRouteId}</div>
              {property.listingStatus ? <div className={styles.badge}>Listing {property.listingStatus}</div> : null}
            </div>
          </div>

          {property.listingAskingPrice ? (
            <div className={styles.priceLine}>Current asking price: {formatCurrency(property.listingAskingPrice, "RWF")}</div>
          ) : null}

          <div className={styles.helperText}>
            If admin approves this transfer, existing draft, active, or inactive listings on this property will be archived.
          </div>
        </section>

        {feedbackMessage && feedback ? (
          <div className={`${styles.feedback} ${getTransferFeedbackTone(feedback.status)}`}>{feedbackMessage}</div>
        ) : null}

        <section className={styles.form}>
          <div className={styles.field}>
            <span className={styles.label}>Choose type</span>
            <div className={styles.modeGrid}>
              <button
                className={`${styles.modeCard}${transferMode === "sale" ? ` ${styles.modeCardActive}` : ""}`}
                onClick={() => setTransferMode("sale")}
                type="button"
              >
                <span className={styles.modeTitle}>Sale</span>
                <span className={styles.modeBody}>Use this when the property is being sold to a buyer.</span>
              </button>
              <button
                className={`${styles.modeCard}${transferMode === "transfer" ? ` ${styles.modeCardActive}` : ""}`}
                onClick={() => setTransferMode("transfer")}
                type="button"
              >
                <span className={styles.modeTitle}>Transfer only</span>
                <span className={styles.modeBody}>Use this for a direct ownership handoff that is not framed as a sale.</span>
              </button>
            </div>
          </div>

          {transferMode ? (
            <form action={createOwnershipTransferAction} className={styles.transferForm}>
              <input name="propertyInternalId" type="hidden" value={property.propertyInternalId} />
              <input name="propertyRouteId" type="hidden" value={property.propertyRouteId} />
              <input name="transferMode" type="hidden" value={transferMode} />

              <label className={styles.field}>
                <span className={styles.label}>{recipientLabel}</span>
                <input className={styles.input} name="buyerEmail" placeholder={recipientPlaceholder} required type="email" />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Note</span>
                <textarea
                  className={styles.textarea}
                  name="transferNote"
                  placeholder={
                    transferMode === "sale"
                      ? "Optional context for the buyer or for admin review."
                      : "Optional context for the recipient or for admin review."
                  }
                  rows={4}
                />
              </label>

              <div className={styles.note}>
                This Amazuga request does not update official land records. For official title-transfer steps in Rwanda, use{" "}
                <a href={IREMBO_TITLE_TRANSFER_FAQ_URL} rel="noreferrer" target="_blank">
                  IremboGov&apos;s land title transfer guidance
                </a>
                .
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryAction} type="submit">
                  {transferMode === "sale" ? "Send sale request" : "Send transfer request"}
                </button>
                <Link className={styles.secondaryAction} href={routes.app.portalProperties}>
                  Cancel
                </Link>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
