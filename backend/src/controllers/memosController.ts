import { Request, Response } from 'express';
import { Memo } from '../models';

export const listMemos = async (req: any, res: Response): Promise<void> => {
  try {
    const memos = await Memo.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, memos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createMemo = async (req: any, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const memo = await Memo.create({
      id: data.id || `MEM-${Date.now()}`,
      memoNumber: data.memoNumber,
      title: data.title,
      releaseDate: data.releaseDate,
      effectiveDate: data.effectiveDate,
      deadlineDate: data.deadlineDate,
      category: data.category,
      priority: data.priority,
      summary: data.summary,
      content: data.content,
      issuerName: data.issuerName,
      issuerTitle: data.issuerTitle,
      issuerTelegram: data.issuerTelegram,
      targetDepartments: data.targetDepartments || [],
      totalRecipients: data.totalRecipients || 0,
      attachedPdfId: data.attachedPdfId || null,
      attachedPdfName: data.attachedPdfName || null,
    } as any);
    res.json({ success: true, memo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const MEMO_UPDATABLE_FIELDS = [
  'memoNumber',
  'title',
  'releaseDate',
  'effectiveDate',
  'deadlineDate',
  'category',
  'priority',
  'summary',
  'content',
  'issuerName',
  'issuerTitle',
  'issuerTelegram',
  'targetDepartments',
  'totalRecipients',
  'attachedPdfId',
  'attachedPdfName',
] as const;

export const updateMemo = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const memo = await Memo.findByPk(id);
    if (!memo) {
      res.status(404).json({ success: false, message: 'Memo not found' });
      return;
    }
    const updates: Record<string, any> = {};
    for (const field of MEMO_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    await memo.update(updates);
    res.json({ success: true, memo });
  } catch (error) {
    console.error('updateMemo error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteMemo = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const memo = await Memo.findByPk(id);
    if (!memo) {
      res.status(404).json({ success: false, message: 'Memo not found' });
      return;
    }
    await memo.destroy();
    res.json({ success: true, message: 'Memo deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
