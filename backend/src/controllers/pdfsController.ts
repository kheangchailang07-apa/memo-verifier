import { Request, Response } from 'express';
import multer from 'multer';
import { PdfDocument } from '../models';
import type { AuthRequest } from '../middlewares/auth';
import { buildPdfKey, uploadPdf, presignGetPdf, deletePdfObject } from '../services/s3';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const PDF_MIME = 'application/pdf';

const errorMessage = (error: any): string => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return 'File size exceeds maximum allowed limit of 25 MB';
  }
  if (error?.name === 'NoCredentials' || error?.name === 'CredentialsProviderError') {
    return 'Storage credentials are unavailable. Check the AWS credential chain.';
  }
  if (error?.name === 'AccessDenied' || error?.$metadata?.httpStatusCode === 403) {
    return 'Storage access was denied. The backend role is missing the required S3 permissions.';
  }
  if (error?.name === 'NoSuchBucket') {
    return 'The configured storage bucket does not exist.';
  }
  return error?.message || 'Internal server error';
};

const ttlSeconds = (): number => {
  const parsed = Number(process.env.AWS_PRESIGNED_URL_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
};

/** Department scope check. Admins, HR, and managers see everything. */
const canAccessPdf = (pdf: PdfDocument, user?: { role: string; department?: string }): boolean => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'hr' || user.role === 'manager') return true;
  if (!pdf.departmentScope || pdf.departmentScope === 'All Departments') return true;
  return user.department === pdf.departmentScope;
};

export const listPdfs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pdfs = await PdfDocument.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, pdfs });
  } catch (error) {
    console.error('listPdfs error:', error);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
};

export const createPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'A PDF file is required.' });
      return;
    }

    const looksLikePdf =
      file.mimetype === PDF_MIME || file.originalname.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) {
      res.status(400).json({ success: false, message: 'Only PDF documents are accepted.' });
      return;
    }

    const fields = (req.body || {}) as Record<string, string>;
    const s3Key = buildPdfKey();
    await uploadPdf(s3Key, file.buffer, PDF_MIME);

    const pdf = await PdfDocument.create({
      id: fields.id || `PDF-${Date.now()}`,
      code: fields.code,
      title: fields.title,
      category: fields.category,
      fileName: file.originalname,
      fileSize: fields.fileSize || `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      fileDataUrl: null,
      s3Key,
      uploadDate: fields.uploadDate || new Date().toISOString().split('T')[0],
      uploadedBy: fields.uploadedBy,
      uploadedByRole: fields.uploadedByRole,
      departmentScope: fields.departmentScope || 'All Departments',
      version: fields.version,
      summary: fields.summary,
      tags: fields.tags ? JSON.parse(fields.tags) : [],
      isMandatory: fields.isMandatory === 'true',
      linkedMemoId: fields.linkedMemoId || null,
      pageCount: fields.pageCount ? Number(fields.pageCount) : null,
    } as any);

    res.json({ success: true, pdf });
  } catch (error) {
    console.error('createPdf error:', error);
    const status = (error as any)?.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
    res.status(status).json({ success: false, message: errorMessage(error) });
  }
};

const PDF_UPDATABLE_FIELDS = [
  'code',
  'title',
  'category',
  'fileName',
  'fileSize',
  'uploadDate',
  'departmentScope',
  'version',
  'summary',
  'isMandatory',
  'linkedMemoId',
  'pageCount',
] as const;

export const updatePdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pdf = await PdfDocument.findByPk(id);
    if (!pdf) {
      res.status(404).json({ success: false, message: 'PDF not found' });
      return;
    }
    const updates: Record<string, any> = {};
    for (const field of PDF_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    await pdf.update(updates);
    res.json({ success: true, pdf });
  } catch (error) {
    console.error('updatePdf error:', error);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
};

/** Issues a short-lived presigned GET URL so the private bucket stays behind auth. */
export const getPdfUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pdf = await PdfDocument.findByPk(id);
    if (!pdf) {
      res.status(404).json({ success: false, message: 'PDF not found' });
      return;
    }

    if (!pdf.s3Key) {
      res.status(409).json({
        success: false,
        message: 'No file is attached to this document yet.',
      });
      return;
    }

    if (!canAccessPdf(pdf, req.user)) {
      res.status(403).json({
        success: false,
        message: 'This document is not available to your department.',
      });
      return;
    }

    const expiresIn = ttlSeconds();
    const url = await presignGetPdf(pdf.s3Key, expiresIn);
    res.json({ success: true, url, expiresIn, fileName: pdf.fileName });
  } catch (error) {
    console.error('getPdfUrl error:', error);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
};

export const deletePdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pdf = await PdfDocument.findByPk(id);
    if (!pdf) {
      res.status(404).json({ success: false, message: 'PDF not found' });
      return;
    }
    await pdf.destroy();

    if (pdf.s3Key) {
      try {
        await deletePdfObject(pdf.s3Key);
      } catch (cleanupError) {
        // The row is already gone; an orphaned object is preferable to a failed delete.
        console.error('deletePdf S3 cleanup failed:', cleanupError);
      }
    }

    res.json({ success: true, message: 'PDF deleted' });
  } catch (error) {
    console.error('deletePdf error:', error);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
};

export const pdfUploadMiddleware = upload.single('file');
