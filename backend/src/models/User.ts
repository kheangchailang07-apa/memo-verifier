import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export type UserRole = 'admin' | 'hr' | 'manager' | 'staff';

export interface UserAttributes {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  email: string;
  username: string | null;
  password: string;
  telegramHandle: string;
  avatar: string;
  status: 'active' | 'suspended';
  credentialType: string;
  lastLogin: string;
  mustChangePassword: boolean;
  assignedDepartments?: string[];
  /** Data URL of the staff member's electronic signature image (PNG/JPEG). */
  signatureDataUrl: string | null;
  /** Original file name of the uploaded signature image, for display only. */
  signatureFileName: string | null;
  /** S3 object key of the electronic signature artwork. */
  signatureS3Key: string | null;
  /** Public/presigned URL to the signature in S3. */
  signatureS3Url: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'username' | 'createdAt' | 'updatedAt' | 'assignedDepartments' | 'lastLogin' | 'mustChangePassword' | 'signatureDataUrl' | 'signatureFileName' | 'signatureS3Key' | 'signatureS3Url'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public name!: string;
  public role!: UserRole;
  public department!: string;
  public jobTitle!: string;
  public email!: string;
  public username!: string | null;
  public password!: string;
  public telegramHandle!: string;
  public avatar!: string;
  public status!: 'active' | 'suspended';
  public credentialType!: string;
  public lastLogin!: string;
  public mustChangePassword!: boolean;
  public assignedDepartments!: string[];
  public signatureDataUrl!: string | null;
  public signatureFileName!: string | null;
  public signatureS3Key!: string | null;
  public signatureS3Url!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'hr', 'manager', 'staff'), allowNull: false },
    department: { type: DataTypes.STRING(100), allowNull: false },
    jobTitle: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    username: { type: DataTypes.STRING(100), allowNull: true, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    telegramHandle: { type: DataTypes.STRING(100), allowNull: false },
    avatar: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'suspended'), allowNull: false, defaultValue: 'active' },
    credentialType: { type: DataTypes.STRING(50), allowNull: false },
    lastLogin: { type: DataTypes.STRING(50), allowNull: false },
    // Set on freshly provisioned accounts (and admin password resets) so the
    // user is forced through a password change before reaching the workspace.
    mustChangePassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    assignedDepartments: { type: DataTypes.JSON, allowNull: true },
    // Electronic signature image (a PNG/JPEG exported from a signature tool).
    // The artwork itself lives in S3 — MEDIUMTEXT only holds a legacy copy
    // that predates the S3 migration and is cleared on the next signature save.
    signatureDataUrl: { type: DataTypes.TEXT('medium'), allowNull: true },
    signatureFileName: { type: DataTypes.STRING(150), allowNull: true },
    // Object key of the signature in the S3 bucket (prefix `signatures_memo`).
    signatureS3Key: { type: DataTypes.STRING(255), allowNull: true },
    // Optional cached presigned/public URL to the S3 object.
    signatureS3Url: { type: DataTypes.STRING(512), allowNull: true },
  },
  { sequelize, tableName: 'users', timestamps: true }
);
