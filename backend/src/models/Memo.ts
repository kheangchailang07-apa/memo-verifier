import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export type MemoPriority = 'Urgent' | 'Mandatory' | 'Standard';

export interface MemoAttributes {
  id: string;
  memoNumber: string;
  title: string;
  releaseDate: string;
  effectiveDate: string;
  deadlineDate: string;
  category: string;
  priority: MemoPriority;
  summary: string;
  content: string;
  issuerName: string;
  issuerTitle: string;
  issuerTelegram: string;
  targetDepartments: string[];
  totalRecipients: number;
  attachedPdfId?: string | null;
  attachedPdfName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MemoCreationAttributes extends Optional<MemoAttributes, 'id' | 'createdAt' | 'updatedAt' | 'attachedPdfId' | 'attachedPdfName'> {}

export class Memo extends Model<MemoAttributes, MemoCreationAttributes> implements MemoAttributes {
  public id!: string;
  public memoNumber!: string;
  public title!: string;
  public releaseDate!: string;
  public effectiveDate!: string;
  public deadlineDate!: string;
  public category!: string;
  public priority!: MemoPriority;
  public summary!: string;
  public content!: string;
  public issuerName!: string;
  public issuerTitle!: string;
  public issuerTelegram!: string;
  public targetDepartments!: string[];
  public totalRecipients!: number;
  public attachedPdfId!: string | null;
  public attachedPdfName!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Memo.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    memoNumber: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    releaseDate: { type: DataTypes.STRING(50), allowNull: false },
    effectiveDate: { type: DataTypes.STRING(50), allowNull: false },
    deadlineDate: { type: DataTypes.STRING(50), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: false },
    priority: { type: DataTypes.ENUM('Urgent', 'Mandatory', 'Standard'), allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    issuerName: { type: DataTypes.STRING(100), allowNull: false },
    issuerTitle: { type: DataTypes.STRING(100), allowNull: false },
    issuerTelegram: { type: DataTypes.STRING(100), allowNull: false },
    targetDepartments: { type: DataTypes.JSON, allowNull: false },
    totalRecipients: { type: DataTypes.INTEGER, allowNull: false },
    attachedPdfId: { type: DataTypes.STRING(50), allowNull: true },
    attachedPdfName: { type: DataTypes.STRING(255), allowNull: true },
  },
  { sequelize, tableName: 'memos', timestamps: true }
);
