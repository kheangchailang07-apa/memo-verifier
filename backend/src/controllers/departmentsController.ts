import { Request, Response } from 'express';
import sequelize from '../config/database';
import { Department, User, Memo, Policy, PdfDocument } from '../models';

const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Legacy lists that shipped hardcoded in the UI. Seeded once so a fresh install
// (and any environment that never had a departments table) keeps working.
export const DEFAULT_DEPARTMENTS = [
  'Engineering',
  'Finance & Accounts',
  'Operations & Logistics',
  'People & HR',
  'Legal & Governance',
];

const toNumber = (value: any): number => (typeof value === 'number' ? value : Number(value) || 0);

// Counts how many users currently sit in each department name.
const countUsersByDepartment = async (): Promise<Map<string, number>> => {
  const rows: any[] = await User.findAll({ attributes: ['department'], raw: true });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = String(row.department ?? '');
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
};

export const listDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.findAll({ order: [['name', 'ASC']] });
    const counts = await countUsersByDepartment();
    res.json({
      success: true,
      departments: departments.map((d) => ({
        ...d.toJSON(),
        userCount: counts.get(d.name) || 0,
      })),
    });
  } catch (error) {
    console.error('listDepartments error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createDepartment = async (req: any, res: Response): Promise<void> => {
  try {
    const name = normalizeName(req.body?.name);
    if (!name) {
      res.status(400).json({ success: false, message: 'Department name is required' });
      return;
    }
    const existing = await Department.findOne({ where: { name } });
    if (existing) {
      res.status(409).json({ success: false, message: `Department "${name}" already exists` });
      return;
    }
    const isActive = req.body?.isActive === undefined ? true : Boolean(req.body.isActive);
    const department = await Department.create({
      id: `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      isActive,
    } as any);
    res.json({ success: true, department: { ...department.toJSON(), userCount: 0 } });
  } catch (error) {
    console.error('createDepartment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Renaming a department rewrites every denormalised reference (users, memos,
// policies, pdf documents) so the string-based records stay consistent.
export const updateDepartment = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const department = await Department.findByPk(id);
    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const updates: { name?: string; isActive?: boolean } = {};

    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) {
        res.status(400).json({ success: false, message: 'Department name cannot be empty' });
        return;
      }
      if (name !== department.name) {
        const clash = await Department.findOne({ where: { name } });
        if (clash && clash.id !== department.id) {
          res.status(409).json({ success: false, message: `Department "${name}" already exists` });
          return;
        }
        updates.name = name;
      }
    }

    if (req.body?.isActive !== undefined) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (updates.name === undefined && updates.isActive === undefined) {
      res.json({ success: true, department: { ...department.toJSON(), userCount: 0 } });
      return;
    }

    const oldName = department.name;
    const newName = updates.name;

    await sequelize.transaction(async (transaction) => {
      await department.update(updates, { transaction });

      if (newName && newName !== oldName) {
        // users.department (scalar)
        await User.update({ department: newName }, { where: { department: oldName }, transaction });

        // users.assignedDepartments (JSON array) — patch in JS so the same logic
        // works whether the driver reports the column as an array or a string.
        const usersWithAssigned = await User.findAll({ attributes: ['id', 'assignedDepartments'], transaction });
        for (const u of usersWithAssigned) {
          const assigned = Array.isArray(u.assignedDepartments) ? u.assignedDepartments : [];
          if (assigned.includes(oldName)) {
            const next = assigned.map((d) => (d === oldName ? newName : d));
            await u.update({ assignedDepartments: next }, { transaction });
          }
        }

        // memos.targetDepartments (JSON array)
        const memos = await Memo.findAll({ attributes: ['id', 'targetDepartments'], transaction });
        for (const m of memos) {
          const targets = Array.isArray(m.targetDepartments) ? m.targetDepartments : [];
          if (targets.includes(oldName)) {
            await m.update({ targetDepartments: targets.map((d) => (d === oldName ? newName : d)) }, { transaction });
          }
        }

        // policies.departmentScope / pdf_documents.departmentScope (scalars)
        await Policy.update({ departmentScope: newName } as any, { where: { departmentScope: oldName }, transaction });
        await PdfDocument.update({ departmentScope: newName }, { where: { departmentScope: oldName }, transaction });
      }
    });

    const counts = await countUsersByDepartment();
    res.json({
      success: true,
      department: { ...department.toJSON(), userCount: counts.get(department.name) || 0 },
      previousName: oldName,
    });
  } catch (error) {
    console.error('updateDepartment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteDepartment = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const department = await Department.findByPk(id);
    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }
    const inUse = await User.count({ where: { department: department.name } });
    if (inUse > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete "${department.name}" — ${inUse} user(s) are still assigned to it. Reassign them first.`,
      });
      return;
    }
    await department.destroy();
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    console.error('deleteDepartment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Runs at startup: ensures the legacy defaults exist and that every department
// name already present on a user row is represented in the table.
export const seedDepartments = async (): Promise<void> => {
  const names = new Set<string>(DEFAULT_DEPARTMENTS);
  const rows: any[] = await User.findAll({ attributes: ['department'], raw: true });
  for (const row of rows) {
    const name = normalizeName(row.department);
    if (name) names.add(name);
  }

  let created = 0;
  for (const name of names) {
    const [row, wasCreated] = await Department.findOrCreate({
      where: { name },
      defaults: { id: `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, isActive: true } as any,
    });
    if (wasCreated && row) created++;
  }
  if (created > 0) {
    console.log(`[DEP] Seeded ${created} department(s).`);
  }
};
