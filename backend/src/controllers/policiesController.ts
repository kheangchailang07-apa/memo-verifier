import { Request, Response } from 'express';
import { Policy } from '../models';

export const listPolicies = async (req: any, res: Response): Promise<void> => {
  try {
    const policies = await Policy.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, policies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createPolicy = async (req: any, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const policy = await Policy.create({
      id: data.id || `POL-${Date.now()}`,
      code: data.code,
      title: data.title,
      category: data.category,
      departmentScope: data.departmentScope,
      version: data.version,
      lastUpdated: data.lastUpdated || new Date().toISOString().split('T')[0],
      effectiveDate: data.effectiveDate,
      summary: data.summary,
      tags: data.tags || [],
      sections: data.sections || [],
      isMandatoryReading: data.isMandatoryReading !== false,
      attachedPdfId: data.attachedPdfId || null,
      attachedPdfName: data.attachedPdfName || null,
    } as any);
    res.json({ success: true, policy });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const POLICY_UPDATABLE_FIELDS = [
  'code',
  'title',
  'category',
  'departmentScope',
  'version',
  'lastUpdated',
  'effectiveDate',
  'summary',
  'tags',
  'sections',
  'isMandatoryReading',
  'attachedPdfId',
  'attachedPdfName',
] as const;

export const updatePolicy = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const policy = await Policy.findByPk(id);
    if (!policy) {
      res.status(404).json({ success: false, message: 'Policy not found' });
      return;
    }
    const updates: Record<string, any> = {};
    for (const field of POLICY_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    await policy.update(updates);
    res.json({ success: true, policy });
  } catch (error) {
    console.error('updatePolicy error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deletePolicy = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const policy = await Policy.findByPk(id);
    if (!policy) {
      res.status(404).json({ success: false, message: 'Policy not found' });
      return;
    }
    await policy.destroy();
    res.json({ success: true, message: 'Policy deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
