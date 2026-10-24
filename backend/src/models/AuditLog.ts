import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export type AuditActionType =
  | 'MEMO_CREATED' | 'MEMO_UPDATED' | 'MEMO_DELETED'
  | 'POLICY_CREATED' | 'POLICY_UPDATED' | 'POLICY_DELETED'
  | 'PDF_UPLOADED' | 'PDF_UPDATED' | 'PDF_DELETED'
  | 'USER_UPDATED' | 'USER_ADDED' | 'USER_CREATED' | 'USER_DELETED' | 'USER_BULK_CREATED' | 'USER_BULK_UPDATED'
  | 'USER_PASSWORD_REVEALED'
  | 'PERMISSIONS_UPDATED' | 'ROLE_PERMISSIONS_UPDATED'
  | 'DEPARTMENT_ADDED' | 'DEPARTMENT_UPDATED' | 'DEPARTMENT_DELETED'
  | 'ACK_STATUS_UPDATED' | 'ACK_VERIFIED'
  | 'BOT_SETTINGS_UPDATED' | 'REMINDER_DISPATCHED' | 'REMINDER_SENT'
  | 'DATA_RESET' | 'DATA_LOADED' | 'DATA_IMPORTED'
  | 'LOGIN' | 'LOGOUT';

export type AuditCategory = 'Directives' | 'Policies' | 'Access & Roles' | 'Verification' | 'System';

export interface AuditLogAttributes {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: 'admin' | 'hr' | 'manager' | 'staff';
  actionType: AuditActionType;
  category: AuditCategory;
  description: string;
  targetId?: string | null;
  targetName?: string | null;
  metadata?: any;
  ipAddress?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id' | 'createdAt' | 'updatedAt' | 'targetId' | 'targetName' | 'metadata' | 'ipAddress'> {}

export class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  public id!: string;
  public timestamp!: string;
  public actorId!: string;
  public actorName!: string;
  public actorEmail!: string;
  public actorRole!: 'admin' | 'hr' | 'manager' | 'staff';
  public actionType!: AuditActionType;
  public category!: AuditCategory;
  public description!: string;
  public targetId!: string | null;
  public targetName!: string | null;
  public metadata!: any;
  public ipAddress!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AuditLog.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    timestamp: { type: DataTypes.STRING(50), allowNull: false },
    actorId: { type: DataTypes.STRING(50), allowNull: false },
    actorName: { type: DataTypes.STRING(100), allowNull: false },
    actorEmail: { type: DataTypes.STRING(150), allowNull: false },
    actorRole: { type: DataTypes.ENUM('admin', 'hr', 'manager', 'staff'), allowNull: false },
    actionType: { type: DataTypes.STRING(50), allowNull: false },
    category: { type: DataTypes.ENUM('Directives', 'Policies', 'Access & Roles', 'Verification', 'System'), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    targetId: { type: DataTypes.STRING(50), allowNull: true },
    targetName: { type: DataTypes.STRING(150), allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    ipAddress: { type: DataTypes.STRING(50), allowNull: true },
  },
  { sequelize, tableName: 'audit_logs', timestamps: true }
);
