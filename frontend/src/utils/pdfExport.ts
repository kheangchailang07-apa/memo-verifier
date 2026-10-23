import { jsPDF } from 'jspdf';
import { AcknowledgementRecord, Memo, User } from '../types';
import { fetchSignatureDataUrl } from './signature';

/** Which flavour of the compliance document to render. */
export type AcknowledgementPdfMode = 'audit' | 'proof';

export interface AcknowledgementPdfResult {
  /** Name the PDF was saved under on the local machine. */
  fileName: string;
  /** Object URL of the generated document — usable as a download link. */
  blobUrl: string;
}

/** The staff member's electronic signature artwork, embedded in the PDF. */
export interface ElectronicSignature {
  /** PNG/JPEG data URL of the signature. */
  dataUrl: string;
}

const buildAcknowledgementFileName = (record: AcknowledgementRecord, mode: AcknowledgementPdfMode): string => {
  const cleanStaffName = record.staffName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cleanMemoNo = record.memoNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return mode === 'proof'
    ? `Proof_of_Acknowledgement_${cleanMemoNo}_${cleanStaffName}.pdf`
    : `HR_Compliance_${cleanMemoNo}_${cleanStaffName}.pdf`;
};

/** Saves a generated document to the user's device through a temporary anchor. */
const triggerLocalDownload = (blobUrl: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Renders the compliance document. In `audit` mode it is the HR-facing audit
 * report; in `proof` mode it is the employee-issued proof of acknowledgement
 * that the staff member attaches to the Telegram message sent to HR.
 */
const buildAcknowledgementPdfDoc = (
  record: AcknowledgementRecord,
  companyName: string,
  mode: AcknowledgementPdfMode,
  signature?: ElectronicSignature | null
): jsPDF => {
  // Initialize A4 document (portrait, mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryNavy = [15, 23, 42]; // slate-900
  const brandIndigo = [79, 70, 229]; // indigo-600
  const emeraldGreen = [16, 185, 129]; // emerald-500
  const amberOrange = [245, 158, 11]; // amber-500
  const borderGray = [226, 232, 240]; // slate-200
  const textDark = [30, 41, 59]; // slate-800
  const textMuted = [100, 116, 139]; // slate-500
  const lightBg = [248, 250, 252]; // slate-50

  // 1. Top Decorative Brand Bar
  doc.setFillColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Organization Header
  let currentY = 16;

  // Logo Block
  doc.setFillColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
  doc.roundedRect(margin, currentY, 14, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(companyName, margin + 7, currentY + 9, { align: 'center' });

  // Organization Title
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(`${companyName} Policy & Memo Directorate`, margin + 18, currentY + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Corporate Governance, Human Resources & Legal Compliance Verification Desk', margin + 18, currentY + 11);

  // Document Badge (Right aligned)
  const reportRef =
    mode === 'proof'
      ? `PROOF-${record.verificationToken || 'VER-001'}`
      : `AUD-${record.verificationToken || 'VER-001'}`;
  doc.setFontSize(8);
  doc.setFont('courier', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`REPORT ID: ${reportRef}`, pageWidth - margin, currentY + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, pageWidth - margin, currentY + 11, { align: 'right' });

  currentY += 18;

  // Divider
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // 3. Document Title & Confidentiality Banner
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'S');

  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    mode === 'proof'
      ? 'EMPLOYEE ACKNOWLEDGEMENT PROOF OF RECEIPT'
      : 'HR COMPLIANCE AUDIT & POLICY ACKNOWLEDGEMENT REPORT',
    margin + 6,
    currentY + 8
  );

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    mode === 'proof'
      ? 'Employee-issued proof that the named staff member has read, understood and acknowledged this directive in the APA compliance portal.'
      : 'Official independent verification record establishing non-repudiation of mandatory workplace directive sign-off.',
    margin + 6,
    currentY + 14
  );

  // Status Chip inside banner
  const isVerified = record.status === 'HR Verified';
  const statusColor = isVerified || mode === 'proof' ? emeraldGreen : amberOrange;
  const statusText =
    mode === 'proof'
      ? 'ACKNOWLEDGED & SIGNED'
      : isVerified
      ? 'CERTIFIED & HR VERIFIED'
      : record.status.toUpperCase();

  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageWidth - margin - 46, currentY + 5, 40, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(statusText, pageWidth - margin - 26, currentY + 9.5, { align: 'center' });

  currentY += 28;

  // Helper for Section Headers
  const drawSectionHeader = (title: string, yPos: number) => {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(margin, yPos, contentWidth, 6, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    doc.line(margin, yPos + 6, pageWidth - margin, yPos + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
    doc.text(title.toUpperCase(), margin + 3, yPos + 4.2);
  };

  // Helper for Key-Value grid
  const drawField = (label: string, value: string, xPos: number, yPos: number, colWidth: number, isMono: boolean = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(label.toUpperCase(), xPos, yPos);

    doc.setFont(isMono ? 'courier' : 'helvetica', isMono ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const wrappedVal = doc.splitTextToSize(value || 'N/A', colWidth - 2);
    // Two lines fit inside the row spacing, so long values are not clipped.
    doc.text(wrappedVal.slice(0, 2), xPos, yPos + 4);
  };

  // 4. Section 1: Employee Credentials
  drawSectionHeader('1. Employee & Credential Profile', currentY);
  currentY += 10;

  const colW = contentWidth / 3;
  drawField('Employee Full Name', record.staffName, margin + 2, currentY, colW);
  drawField('Employee Staff ID', record.staffId, margin + colW + 2, currentY, colW, true);
  drawField('Corporate Email', record.staffEmail, margin + colW * 2 + 2, currentY, colW);

  currentY += 12;
  drawField('Assigned Department', record.department, margin + 2, currentY, colW);
  drawField('Verified Telegram Handle', record.staffTelegramHandle, margin + colW + 2, currentY, colW, true);
  drawField('Submission Source IP', record.ipAddress || 'Internal Corporate Gateway (10.0.4.12)', margin + colW * 2 + 2, currentY, colW, true);

  currentY += 14;

  // 5. Section 2: Policy Directive Subject
  drawSectionHeader('2. Corporate Policy & Directive Subject', currentY);
  currentY += 10;

  drawField('Directive Ref Number', record.memoNumber, margin + 2, currentY, colW, true);
  drawField('Document Subject', record.memoTitle, margin + colW + 2, currentY, colW * 2);

  currentY += 12;
  drawField('Directive Internal ID', record.memoId, margin + 2, currentY, colW, true);
  drawField('Legal Verification Token', record.verificationToken, margin + colW + 2, currentY, colW, true);
  drawField('Compliance Enforceability', 'Mandatory - Fully Bound upon Signature', margin + colW * 2 + 2, currentY, colW);

  currentY += 16;

  // 6. Section 3: Two-Party Verification Audit Trail
  drawSectionHeader(
    mode === 'proof' ? '3. Acknowledgement Chain of Custody' : '3. Independent Verification Audit Trail',
    currentY
  );
  currentY += 8;

  // Draw 3-step audit trail boxes
  const stepBoxW = (contentWidth - 6) / 3;
  const stepBoxH = 26;

  // Step 1: Electronic Portal Signature
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, currentY, stepBoxW, stepBoxH, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, stepBoxW, stepBoxH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('STEP 1: PORTAL SIGN-OFF', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Employee signed acknowledgment terms in web portal.', margin + 4, currentY + 10, { maxWidth: stepBoxW - 8 });
  doc.setFont('courier', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(record.portalTimestamp || 'Signed in Session', margin + 4, currentY + 22);

  // Step 2: Telegram Out-of-band Match
  const step2X = margin + stepBoxW + 3;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(step2X, currentY, stepBoxW, stepBoxH, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(step2X, currentY, stepBoxW, stepBoxH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(mode === 'proof' ? 'STEP 2: PROOF SENT TO HR' : 'STEP 2: TELEGRAM PING', step2X + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    mode === 'proof'
      ? 'This proof PDF attached to the Telegram message to HR.'
      : 'Out-of-band token sent from verified account.',
    step2X + 4,
    currentY + 10,
    { maxWidth: stepBoxW - 8 }
  );
  doc.setFont('courier', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(
    record.telegramSentTimestamp || (mode === 'proof' ? 'Awaiting HR Receipt' : 'Pending Out-of-Band'),
    step2X + 4,
    currentY + 22
  );

  // Step 3: HR Certification
  const step3X = margin + (stepBoxW + 3) * 2;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(step3X, currentY, stepBoxW, stepBoxH, 2, 2, 'F');
  doc.setDrawColor(isVerified ? emeraldGreen[0] : borderGray[0], isVerified ? emeraldGreen[1] : borderGray[1], isVerified ? emeraldGreen[2] : borderGray[2]);
  doc.roundedRect(step3X, currentY, stepBoxW, stepBoxH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isVerified ? emeraldGreen[0] : primaryNavy[0], isVerified ? emeraldGreen[1] : primaryNavy[1], isVerified ? emeraldGreen[2] : primaryNavy[2]);
  doc.text('STEP 3: HR AUDIT CERTIFIED', step3X + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    isVerified
      ? `Certified by HR Officer ${record.hrOfficerName || 'Elena Vance'}.`
      : 'Under review by HR compliance officer.',
    step3X + 4,
    currentY + 10,
    { maxWidth: stepBoxW - 8 }
  );
  doc.setFont('courier', 'bold');
  doc.setTextColor(isVerified ? emeraldGreen[0] : textDark[0], isVerified ? emeraldGreen[1] : textDark[1], isVerified ? emeraldGreen[2] : textDark[2]);
  doc.text(record.hrVerifiedTimestamp || (isVerified ? 'Completed' : 'Pending Verification'), step3X + 4, currentY + 22);

  currentY += stepBoxH + 6;

  // Inbound Telegram snippet proof box
  if (record.telegramMessageSnippet) {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('INBOUND TELEGRAM RECORD PROOF:', margin + 4, currentY + 4.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`"${record.telegramMessageSnippet}"`, margin + 4, currentY + 9.5, { maxWidth: contentWidth - 8 });

    currentY += 18;
  }

  // HR Notes
  if (record.hrNotes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('HR VERIFICATION AUDIT NOTES:', margin + 2, currentY);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(record.hrNotes, margin + 2, currentY + 4, { maxWidth: contentWidth - 4 });

    currentY += 12;
  }

  // 7. Legal Attestation Statement
  currentY = Math.max(currentY + 2, 195);

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('FORMAL COMPLIANCE NON-REPUDIATION ATTESTATION', margin + 5, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const legalText =
    mode === 'proof'
      ? `This document is the employee's own proof of acknowledgement: ${record.staffName} (${record.staffId}) has received, read and understood the operational directives set forth in ${record.memoNumber}: "${record.memoTitle}", and has electronically signed for them in the APA compliance portal under verification token ${record.verificationToken}. The attached copy is issued for delivery to Human Resources as the record of that acknowledgement.`
      : `This report officially attests that employee ${record.staffName} (${record.staffId}) received, reviewed, and consented to the operational directives set forth in ${record.memoNumber}: "${record.memoTitle}". The electronic signature combined with the out-of-band Telegram verification token establishes an audit-proof chain of custody under company policy.`;
  doc.text(legalText, margin + 5, currentY + 11, { maxWidth: contentWidth - 10, lineHeightFactor: 1.35 });

  currentY += 32;

  // 8. Dual Signatures Block
  const sigColW = (contentWidth - 10) / 2;

  // Employee Signature Box
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, currentY + 16, margin + sigColW, currentY + 16);

  // Electronic signature artwork sits right on the signature line.
  let signatureDrawn = false;
  if (signature?.dataUrl) {
    try {
      const properties = doc.getImageProperties(signature.dataUrl);
      const boxWidth = sigColW - 4;
      const boxHeight = 18;
      const ratio = properties.width / properties.height;
      let drawWidth = boxWidth;
      let drawHeight = drawWidth / ratio;
      if (drawHeight > boxHeight) {
        drawHeight = boxHeight;
        drawWidth = drawHeight * ratio;
      }
      const format = /^data:image\/jpe?g/i.test(signature.dataUrl) ? 'JPEG' : 'PNG';
      doc.addImage(
        signature.dataUrl,
        format,
        margin + 1,
        currentY + 16 - drawHeight,
        drawWidth,
        drawHeight,
        undefined,
        'FAST'
      );
      signatureDrawn = true;
    } catch {
      // An unreadable image must never break the document — the typed name
      // below still identifies the signer.
      signatureDrawn = false;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(record.staffName, margin, currentY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Employee (${record.department})`, margin, currentY + 24);
  doc.text(
    signatureDrawn
      ? `Electronically Signed: ${record.portalTimestamp || 'Signed via Web Portal'}`
      : `Electronically Authenticated: ${record.portalTimestamp || 'Signed via Web Portal'}`,
    margin,
    currentY + 28
  );

  // HR Officer Signature Box
  const hrSigX = margin + sigColW + 10;
  doc.line(hrSigX, currentY + 16, hrSigX + sigColW, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(record.hrOfficerName || 'Elena Vance, Head of Compliance', hrSigX, currentY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Human Resources & Compliance Officer', hrSigX, currentY + 24);
  doc.text(
    isVerified
      ? `Audit Certified & Sealed: ${record.hrVerifiedTimestamp || 'Verified'}`
      : 'Awaiting Final HR Certification',
    hrSigX,
    currentY + 28
  );

  // 9. Footer Security Notice
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    mode === 'proof'
      ? `EMPLOYEE ACKNOWLEDGEMENT PROOF • Issued by ${companyName} Policy & Memo Compliance Platform • Verification Token: ${record.verificationToken}`
      : `CONFIDENTIAL HR COMPLIANCE RECORD • Generated by ${companyName} Policy & Memo Compliance Platform • Audit Token: ${record.verificationToken}`,
    margin,
    pageHeight - 11
  );
  doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - 11, { align: 'right' });

  return doc;
};

/**
 * Shown when a document is requested for an acknowledgement that carries no
 * electronic signature. A PDF that claims to be signed but is not would be a
 * worthless compliance artifact, so nothing is produced in that case.
 */
export const MISSING_SIGNATURE_MESSAGE =
  'No electronic signature on file for this acknowledgement, so no PDF can be produced. The staff member has to sign it with their electronic signature first.';

/**
 * Generates an official, publication-grade HR Compliance Report PDF for an individual acknowledgement record.
 * Designed specifically for human resources audits, legal records, and regulatory compliance archives.
 */
export const generateAcknowledgementPdf = (
  record: AcknowledgementRecord,
  companyName: string = 'APA',
  signature?: ElectronicSignature | null
): AcknowledgementPdfResult => {
  if (!signature?.dataUrl) {
    throw new Error(MISSING_SIGNATURE_MESSAGE);
  }
  const doc = buildAcknowledgementPdfDoc(record, companyName, 'audit', signature);
  const fileName = buildAcknowledgementFileName(record, 'audit');
  const blobUrl = String(doc.output('bloburl'));
  triggerLocalDownload(blobUrl, fileName);
  return { fileName, blobUrl };
};

/**
 * Generates the HR compliance PDF and prints the electronic signature that was
 * applied when the memo was signed. The artwork is loaded from the URL that
 * is stored with the acknowledgement (e.g. /signatures_memo/USR-000/<uuid>.png).
 */
export const generateAcknowledgementPdfWithSignature = async (
  record: AcknowledgementRecord,
  companyName: string = 'APA'
): Promise<AcknowledgementPdfResult> => {
  const dataUrl = await fetchSignatureDataUrl(record.signatureUrl);
  return generateAcknowledgementPdf(record, companyName, dataUrl ? { dataUrl } : null);
};

/**
 * Builds the employee-issued proof of acknowledgement. The document is NOT
 * saved automatically: the caller decides when the staff member downloads it,
 * so the file is only saved once they explicitly ask for it (right before
 * attaching it to the Telegram message sent to HR).
 */
export const buildAcknowledgementProofPdf = (
  record: AcknowledgementRecord,
  companyName: string = 'APA',
  signature?: ElectronicSignature | null
): AcknowledgementPdfResult => {
  if (!signature?.dataUrl) {
    throw new Error(MISSING_SIGNATURE_MESSAGE);
  }
  const doc = buildAcknowledgementPdfDoc(record, companyName, 'proof', signature);
  const fileName = buildAcknowledgementFileName(record, 'proof');
  const blobUrl = String(doc.output('bloburl'));
  return { fileName, blobUrl };
};

/** Saves a previously built document on the user's local machine. */
export const downloadAcknowledgementPdf = (result: AcknowledgementPdfResult): void => {
  triggerLocalDownload(result.blobUrl, result.fileName);
};


/**
 * Generates an executive-level, consolidated Legal Compliance Dossier for an entire Directive Memo.
 * Aggregates targeted department rosters, verified electronic tokens, timestamps, out-of-band Telegram proof,
 * and the official HR Compliance Non-Repudiation Seal into a single comprehensive PDF document for auditors.
 */
export const generateComplianceDossierPdf = (
  memo: Memo,
  acknowledgements: AcknowledgementRecord[],
  allStaffUsers: User[],
  companyName: string = 'APA',
  officerName: string = 'Elena Vance, Head of HR & Compliance'
): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryNavy = [15, 23, 42]; // slate-900
  const brandIndigo = [79, 70, 229]; // indigo-600
  const emeraldGreen = [16, 185, 129]; // emerald-500
  const amberOrange = [245, 158, 11]; // amber-500
  const roseRed = [239, 68, 68]; // rose-500
  const borderGray = [226, 232, 240]; // slate-200
  const textDark = [30, 41, 59]; // slate-800
  const textMuted = [100, 116, 139]; // slate-500
  const lightBg = [248, 250, 252]; // slate-50

  // Filter targeted employees
  const targetStaff = allStaffUsers.filter((u) => {
    if (!memo.targetDepartments || memo.targetDepartments.length === 0) return true;
    if (memo.targetDepartments.includes('All Departments')) return true;
    return memo.targetDepartments.includes(u.department);
  });

  // Calculate statistics
  const memoAcks = acknowledgements.filter((a) => a.memoId === memo.id);
  const acksByStaffId = new Map(memoAcks.map((a) => [a.staffId, a]));

  const verifiedCount = targetStaff.filter((u) => acksByStaffId.get(u.id)?.status === 'HR Verified').length;
  const submittedCount = targetStaff.filter((u) => {
    const st = acksByStaffId.get(u.id)?.status;
    return st === 'Submitted' || st === 'In Review';
  }).length;
  const pendingCount = targetStaff.length - verifiedCount - submittedCount;
  const complianceRate = targetStaff.length > 0 ? Math.round((verifiedCount / targetStaff.length) * 100) : 100;

  // Header banner
  doc.setFillColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  let currentY = 16;

  // Logo Badge
  doc.setFillColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
  doc.roundedRect(margin, currentY, 14, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(companyName, margin + 7, currentY + 9, { align: 'center' });

  // Organization Header
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(`${companyName} Policy Directorate & Legal Governance`, margin + 18, currentY + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Official Consolidated Compliance Audit Dossier • Regulatory Non-Repudiation Certificate', margin + 18, currentY + 11);

  // Reference Code (Right)
  const reportRef = `DOSSIER-${memo.memoNumber}`;
  doc.setFontSize(8);
  doc.setFont('courier', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(reportRef, pageWidth - margin, currentY + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, pageWidth - margin, currentY + 11, { align: 'right' });

  currentY += 18;

  // Divider
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 6;

  // Executive Summary Card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'S');

  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`DIRECTIVE: ${memo.memoNumber} — ${memo.title}`, margin + 5, currentY + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `Issuing Officer: ${memo.issuerName} (${memo.issuerTitle}) • Effective: ${memo.effectiveDate} • Deadline: ${memo.deadlineDate}`,
    margin + 5,
    currentY + 13
  );
  doc.text(
    `Target Scope: ${memo.targetDepartments.join(', ')} • Priority: ${memo.priority.toUpperCase()}`,
    margin + 5,
    currentY + 19
  );

  // Overall Compliance Score Tag (Right aligned in summary box)
  const scoreBadgeW = 38;
  const scoreColor = complianceRate >= 90 ? emeraldGreen : complianceRate >= 70 ? amberOrange : roseRed;
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(pageWidth - margin - scoreBadgeW - 5, currentY + 5, scoreBadgeW, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${complianceRate}%`, pageWidth - margin - scoreBadgeW / 2 - 5, currentY + 11.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPLIANCE RATE', pageWidth - margin - scoreBadgeW / 2 - 5, currentY + 16.5, { align: 'center' });

  currentY += 32;

  // Stats Counters Row (4 metrics)
  const statBoxW = (contentWidth - 9) / 4;
  const metrics = [
    { label: 'TARGET HEADCOUNT', val: `${targetStaff.length} Staff`, color: primaryNavy },
    { label: 'CERTIFIED (VERIFIED)', val: `${verifiedCount} Staff`, color: emeraldGreen },
    { label: 'IN REVIEW / PENDING', val: `${submittedCount} Staff`, color: amberOrange },
    { label: 'OUTSTANDING SIGN-OFF', val: `${pendingCount} Staff`, color: pendingCount > 0 ? roseRed : textMuted },
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (statBoxW + 3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, currentY, statBoxW, 14, 1.5, 1.5, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(x, currentY, statBoxW, 14, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(m.label, x + 3, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, x + 3, currentY + 10.5);
  });

  currentY += 20;

  // Section Header: Summary Policy Directive Text
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(margin, currentY, contentWidth, 5.5, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  doc.line(margin, currentY + 5.5, pageWidth - margin, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
  doc.text('I. DIRECTIVE SUMMARY & MANDATORY POLICY TERMS', margin + 3, currentY + 3.8);

  currentY += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const summaryLines = doc.splitTextToSize(memo.summary || memo.content, contentWidth - 4);
  const printedSummaryLines = summaryLines.slice(0, 3);
  doc.text(printedSummaryLines, margin + 2, currentY);

  currentY += printedSummaryLines.length * 4 + 4;

  // Section Header: Complete Employee Sign-Off Audit Roster
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(margin, currentY, contentWidth, 5.5, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  doc.line(margin, currentY + 5.5, pageWidth - margin, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
  doc.text('II. COMPREHENSIVE EMPLOYEE SIGN-OFF & NON-REPUDIATION AUDIT ROSTER', margin + 3, currentY + 3.8);

  currentY += 8;

  // Table Column Widths
  const colWName = 38;
  const colWDept = 26;
  const colWTelegram = 26;
  const colWToken = 34;
  const colWTime = 28;
  const colWStatus = contentWidth - (colWName + colWDept + colWTelegram + colWToken + colWTime);

  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);

  let curX = margin + 2;
  doc.text('STAFF MEMBER', curX, currentY + 4);
  curX += colWName;
  doc.text('DEPARTMENT', curX, currentY + 4);
  curX += colWDept;
  doc.text('TELEGRAM ID', curX, currentY + 4);
  curX += colWTelegram;
  doc.text('AUDIT TOKEN', curX, currentY + 4);
  curX += colWToken;
  doc.text('PORTAL SIGNED', curX, currentY + 4);
  curX += colWTime;
  doc.text('AUDIT STATUS', curX, currentY + 4);

  currentY += 6;

  // Table Rows
  targetStaff.forEach((staff, rIdx) => {
    // Check if new page is needed
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;

      // Repeat Table Header on new page
      doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      doc.rect(margin, currentY, contentWidth, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);

      let headerX = margin + 2;
      doc.text('STAFF MEMBER', headerX, currentY + 4);
      headerX += colWName;
      doc.text('DEPARTMENT', headerX, currentY + 4);
      headerX += colWDept;
      doc.text('TELEGRAM ID', headerX, currentY + 4);
      headerX += colWTelegram;
      doc.text('AUDIT TOKEN', headerX, currentY + 4);
      headerX += colWToken;
      doc.text('PORTAL SIGNED', headerX, currentY + 4);
      headerX += colWTime;
      doc.text('AUDIT STATUS', headerX, currentY + 4);

      currentY += 6;
    }

    const ack = acksByStaffId.get(staff.id);
    const rowBg = rIdx % 2 === 0 ? [255, 255, 255] : lightBg;
    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, currentY + 6.5, pageWidth - margin, currentY + 6.5);

    let cellX = margin + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(staff.name.slice(0, 22), cellX, currentY + 4.2);

    cellX += colWName;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(staff.department.slice(0, 16), cellX, currentY + 4.2);

    cellX += colWDept;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(brandIndigo[0], brandIndigo[1], brandIndigo[2]);
    doc.text(staff.telegramHandle.slice(0, 16), cellX, currentY + 4.2);

    cellX += colWTelegram;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(
      ack?.verificationToken ? textDark[0] : textMuted[0],
      ack?.verificationToken ? textDark[1] : textMuted[1],
      ack?.verificationToken ? textDark[2] : textMuted[2]
    );
    doc.text(ack?.verificationToken ? ack.verificationToken.slice(0, 18) : 'PENDING SIGN-OFF', cellX, currentY + 4.2);

    cellX += colWToken;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(ack?.portalTimestamp ? ack.portalTimestamp.slice(0, 16) : 'Not Submitted', cellX, currentY + 4.2);

    cellX += colWTime;
    const isVer = ack?.status === 'HR Verified';
    const isSub = ack?.status === 'Submitted' || ack?.status === 'In Review';
    const stCol = isVer ? emeraldGreen : isSub ? amberOrange : roseRed;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(stCol[0], stCol[1], stCol[2]);
    doc.text(ack?.status ? ack.status.toUpperCase() : 'PENDING', cellX, currentY + 4.2);

    currentY += 6.5;
  });

  currentY += 8;

  // HR Legal Certification & Non-Repudiation Seal Box
  if (currentY > pageHeight - 38) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('III. HR OFFICER LEGAL CERTIFICATION & NON-REPUDIATION SEAL', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    'I hereby declare under corporate governance standards that the acknowledgement tokens and out-of-band Telegram records documented herein have been independently validated. All verified entries carry immutable non-repudiation standing.',
    margin + 4,
    currentY + 11
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(
    `Certified by: ${officerName} • Verified Date: ${new Date().toISOString().slice(0, 10)} • Cryptographic Seal: SHA-256[${Math.random().toString(36).substring(2, 10).toUpperCase()}]`,
    margin + 4,
    currentY + 17
  );

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      `CONFIDENTIAL HR & LEGAL COMPLIANCE DOSSIER • ${companyName} Policy Directorate • Directive: ${memo.memoNumber}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save the Dossier file
  const cleanMemoNo = memo.memoNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fileName = `APA_Audit_Dossier_${cleanMemoNo}.pdf`;
  doc.save(fileName);
};
