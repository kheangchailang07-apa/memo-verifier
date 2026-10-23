import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface RolePermissionsAttributes {
  id: number;
  role: 'admin' | 'hr' | 'manager' | 'staff';
  canViewHandbook: boolean;
  canViewAllStaffStatus: boolean;
  canVerifyAcknowledgements: boolean;
  canCreateMemos: boolean;
  canUploadDocuments: boolean;
  canManageTelegramBot: boolean;
  canManageUsersAndRoles: boolean;
  canExportAuditLogs: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RolePermissionsCreationAttributes extends Optional<RolePermissionsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class RolePermissions extends Model<RolePermissionsAttributes, RolePermissionsCreationAttributes> implements RolePermissionsAttributes {
  public id!: number;
  public role!: 'admin' | 'hr' | 'manager' | 'staff';
  public canViewHandbook!: boolean;
  public canViewAllStaffStatus!: boolean;
  public canVerifyAcknowledgements!: boolean;
  public canCreateMemos!: boolean;
  public canUploadDocuments!: boolean;
  public canManageTelegramBot!: boolean;
  public canManageUsersAndRoles!: boolean;
  public canExportAuditLogs!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RolePermissions.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    role: { type: DataTypes.ENUM('admin', 'hr', 'manager', 'staff'), allowNull: false, unique: true },
    canViewHandbook: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    canViewAllStaffStatus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canVerifyAcknowledgements: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canCreateMemos: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canUploadDocuments: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canManageTelegramBot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canManageUsersAndRoles: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canExportAuditLogs: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, tableName: 'role_permissions', timestamps: true }
);
