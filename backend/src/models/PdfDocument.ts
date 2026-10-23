import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PdfDocumentAttributes {
  id: string;
  code: string;
  title: string;
  category: 'Conduct & Ethics' | 'Leave & Attendance' | 'IT & Security' | 'Workplace & Remote' | 'Compensation & Benefits' | 'General';
  fileName: string;
fileSize: string;
  /** Legacy: base64 data URL. Retained for rollback only; superseded by s3Key. */
  fileDataUrl?: string | null;
  /** S3 object key under AWS_S3_PREFIX. Null until a file is uploaded or migrated. */
  s3Key?: string | null;
  uploadDate: string;
  uploadedBy: string;
  uploadedByRole: string;
  departmentScope: string;
  version: string;
  summary: string;
  tags: string[];
  isMandatory: boolean;
  linkedMemoId?: string | null;
  pageCount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PdfDocumentCreationAttributes extends Optional<PdfDocumentAttributes, 'id' | 'createdAt' | 'updatedAt' | 'fileDataUrl' | 's3Key' | 'linkedMemoId' | 'pageCount'> {}

export class PdfDocument extends Model<PdfDocumentAttributes, PdfDocumentCreationAttributes> implements PdfDocumentAttributes {
  public id!: string;
  public code!: string;
  public title!: string;
  public category!: PdfDocumentAttributes['category'];
  public fileName!: string;
public fileSize!: string;
  public fileDataUrl!: string | null;
  public s3Key!: string | null;
  public uploadDate!: string;
  public uploadedBy!: string;
  public uploadedByRole!: string;
  public departmentScope!: string;
  public version!: string;
  public summary!: string;
  public tags!: string[];
  public isMandatory!: boolean;
  public linkedMemoId!: string | null;
  public pageCount!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PdfDocument.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    category: { type: DataTypes.ENUM('Conduct & Ethics', 'Leave & Attendance', 'IT & Security', 'Workplace & Remote', 'Compensation & Benefits', 'General'), allowNull: false },
    fileName: { type: DataTypes.STRING(255), allowNull: false },
    fileSize: { type: DataTypes.STRING(50), allowNull: false },
    fileDataUrl: { type: DataTypes.TEXT('long'), allowNull: true },
    s3Key: { type: DataTypes.STRING(255), allowNull: true },
    uploadDate: { type: DataTypes.STRING(50), allowNull: false },
    uploadedBy: { type: DataTypes.STRING(100), allowNull: false },
    uploadedByRole: { type: DataTypes.STRING(50), allowNull: false },
    departmentScope: { type: DataTypes.STRING(100), allowNull: false },
    version: { type: DataTypes.STRING(20), allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.JSON, allowNull: false },
    isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    linkedMemoId: { type: DataTypes.STRING(50), allowNull: true },
    pageCount: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'pdf_documents', timestamps: true }
);
