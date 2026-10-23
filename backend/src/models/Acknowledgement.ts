import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export type AckStatus = 'Unacknowledged' | 'Submitted' | 'In Review' | 'HR Verified';

export interface AcknowledgementAttributes {
  id: string;
  memoId: string;
  memoNumber: string;
  memoTitle: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  department: string;
  staffTelegramHandle: string;
  status: AckStatus;
  verificationToken: string;
  portalTimestamp?: string | null;
  telegramSentTimestamp?: string | null;
  telegramMessageSnippet?: string | null;
  hrVerifiedTimestamp?: string | null;
  hrOfficerName?: string | null;
  hrNotes?: string | null;
  ipAddress?: string | null;
  /** S3 object key of the signature that was applied when the memo was signed. */
  signatureS3Key?: string | null;
  /** URL of the applied signature as served by this app (never an AWS link). */
  signatureUrl?: string | null;
  /** True when the staff member signed the memo with their electronic signature. */
  signatureApplied?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AcknowledgementCreationAttributes extends Optional<AcknowledgementAttributes, 'id' | 'createdAt' | 'updatedAt' | 'portalTimestamp' | 'telegramSentTimestamp' | 'telegramMessageSnippet' | 'hrVerifiedTimestamp' | 'hrOfficerName' | 'hrNotes' | 'ipAddress' | 'signatureS3Key' | 'signatureUrl' | 'signatureApplied'> {}

export class Acknowledgement extends Model<AcknowledgementAttributes, AcknowledgementCreationAttributes> implements AcknowledgementAttributes {
  public id!: string;
  public memoId!: string;
  public memoNumber!: string;
  public memoTitle!: string;
  public staffId!: string;
  public staffName!: string;
  public staffEmail!: string;
  public department!: string;
  public staffTelegramHandle!: string;
  public status!: AckStatus;
  public verificationToken!: string;
  public portalTimestamp!: string | null;
  public telegramSentTimestamp!: string | null;
  public telegramMessageSnippet!: string | null;
  public hrVerifiedTimestamp!: string | null;
  public hrOfficerName!: string | null;
  public hrNotes!: string | null;
  public ipAddress!: string | null;
  public signatureS3Key!: string | null;
  public signatureUrl!: string | null;
  public signatureApplied!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Acknowledgement.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    memoId: { type: DataTypes.STRING(50), allowNull: false },
    memoNumber: { type: DataTypes.STRING(50), allowNull: false },
    memoTitle: { type: DataTypes.STRING(200), allowNull: false },
    staffId: { type: DataTypes.STRING(50), allowNull: false },
    staffName: { type: DataTypes.STRING(100), allowNull: false },
    staffEmail: { type: DataTypes.STRING(150), allowNull: false },
    department: { type: DataTypes.STRING(100), allowNull: false },
    staffTelegramHandle: { type: DataTypes.STRING(100), allowNull: false },
    status: { type: DataTypes.ENUM('Unacknowledged', 'Submitted', 'In Review', 'HR Verified'), allowNull: false, defaultValue: 'Unacknowledged' },
    verificationToken: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    portalTimestamp: { type: DataTypes.STRING(50), allowNull: true },
    telegramSentTimestamp: { type: DataTypes.STRING(50), allowNull: true },
    telegramMessageSnippet: { type: DataTypes.TEXT, allowNull: true },
    hrVerifiedTimestamp: { type: DataTypes.STRING(50), allowNull: true },
    hrOfficerName: { type: DataTypes.STRING(100), allowNull: true },
    hrNotes: { type: DataTypes.TEXT, allowNull: true },
    ipAddress: { type: DataTypes.STRING(50), allowNull: true },
    // The exact signature object that was applied at signing time. It is a
    // snapshot: replacing the artwork on the account never rewrites history.
    signatureS3Key: { type: DataTypes.STRING(255), allowNull: true },
    // The URL of that signature as served by this app (not a presigned AWS URL).
    signatureUrl: { type: DataTypes.STRING(512), allowNull: true },
    // True when the electronic signature was used to sign the memo.
    signatureApplied: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, tableName: 'acknowledgements', timestamps: true }
);
