import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface TelegramBotSettingsAttributes {
  id: number;
  botName: string;
  botUsername: string;
  hrOfficerTelegram: string;
  hrOfficerUsername: string | null;
  channelName: string;
  botToken: string | null;
  autoVerifyWithBotToken: boolean;
  activeStatusScheme: 'standard' | 'formal';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TelegramBotSettingsCreationAttributes extends Optional<TelegramBotSettingsAttributes, 'id' | 'botToken' | 'hrOfficerUsername' | 'createdAt' | 'updatedAt'> {}

export class TelegramBotSettings extends Model<TelegramBotSettingsAttributes, TelegramBotSettingsCreationAttributes> implements TelegramBotSettingsAttributes {
  public id!: number;
  public botName!: string;
  public botUsername!: string;
  public hrOfficerTelegram!: string;
  public hrOfficerUsername!: string | null;
  public channelName!: string;
  public botToken!: string | null;
  public autoVerifyWithBotToken!: boolean;
  public activeStatusScheme!: 'standard' | 'formal';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TelegramBotSettings.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    botName: { type: DataTypes.STRING(100), allowNull: false },
    botUsername: { type: DataTypes.STRING(100), allowNull: false },
    hrOfficerTelegram: { type: DataTypes.STRING(100), allowNull: false },
    hrOfficerUsername: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    channelName: { type: DataTypes.STRING(100), allowNull: false },
    botToken: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    autoVerifyWithBotToken: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    activeStatusScheme: { type: DataTypes.ENUM('standard', 'formal'), allowNull: false, defaultValue: 'standard' },
  },
  { sequelize, tableName: 'bot_settings', timestamps: true }
);
