import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PolicyAttributes {
  id: string;
  code: string;
  title: string;
  category: 'Conduct & Ethics' | 'Leave & Attendance' | 'IT & Security' | 'Workplace & Remote' | 'Compensation & Benefits';
  departmentScope: string;
  version: string;
  lastUpdated: string;
  effectiveDate: string;
  summary: string;
  tags: string[];
  sections: any[];
  isMandatoryReading: boolean;
  attachedPdfId?: string | null;
  attachedPdfName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PolicyCreationAttributes extends Optional<PolicyAttributes, 'id' | 'createdAt' | 'updatedAt' | 'attachedPdfId' | 'attachedPdfName'> {}

export class Policy extends Model<PolicyAttributes, PolicyCreationAttributes> implements PolicyAttributes {
  public id!: string;
  public code!: string;
  public title!: string;
  public category!: PolicyAttributes['category'];
  public departmentScope!: string;
  public version!: string;
  public lastUpdated!: string;
  public effectiveDate!: string;
  public summary!: string;
  public tags!: string[];
  public sections!: any[];
  public isMandatoryReading!: boolean;
  public attachedPdfId!: string | null;
  public attachedPdfName!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Policy.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    category: { type: DataTypes.ENUM('Conduct & Ethics', 'Leave & Attendance', 'IT & Security', 'Workplace & Remote', 'Compensation & Benefits'), allowNull: false },
    departmentScope: { type: DataTypes.STRING(100), allowNull: false },
    version: { type: DataTypes.STRING(20), allowNull: false },
    lastUpdated: { type: DataTypes.STRING(50), allowNull: false },
    effectiveDate: { type: DataTypes.STRING(50), allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.JSON, allowNull: false },
    sections: { type: DataTypes.JSON, allowNull: false },
    isMandatoryReading: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    attachedPdfId: { type: DataTypes.STRING(50), allowNull: true },
    attachedPdfName: { type: DataTypes.STRING(255), allowNull: true },
  },
  { sequelize, tableName: 'policies', timestamps: true }
);
