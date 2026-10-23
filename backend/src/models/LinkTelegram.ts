import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface LinkTelegramAttributes {
  id: string;
  userId: string;
  code: string;
  chatId: string | null;
  telegramUsername: string | null;
  telegramName: string | null;
  status: 'pending' | 'linked';
  requestedAt: Date;
  linkedAt: Date | null;
  /** Newest /start <code> update_id seen when the link was requested - older taps never count. */
  baselineUpdateId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LinkTelegramCreationAttributes
  extends Optional<LinkTelegramAttributes, 'chatId' | 'telegramUsername' | 'telegramName' | 'linkedAt' | 'baselineUpdateId' | 'createdAt' | 'updatedAt'> {}

export class LinkTelegram extends Model<LinkTelegramAttributes, LinkTelegramCreationAttributes> implements LinkTelegramAttributes {
  public id!: string;
  public userId!: string;
  public code!: string;
  public chatId!: string | null;
  public telegramUsername!: string | null;
  public telegramName!: string | null;
  public status!: 'pending' | 'linked';
  public requestedAt!: Date;
  public linkedAt!: Date | null;
  public baselineUpdateId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LinkTelegram.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    userId: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    chatId: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    telegramUsername: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    telegramName: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    status: { type: DataTypes.ENUM('pending', 'linked'), allowNull: false, defaultValue: 'pending' },
    requestedAt: { type: DataTypes.DATE, allowNull: false },
    linkedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    baselineUpdateId: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: 'link_telegram', timestamps: true }
);