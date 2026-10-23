import sequelize from '../config/database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface SessionAttributes {
  id: string;
  userId: string;
  refreshToken: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SessionCreationAttributes extends Optional<SessionAttributes, 'id' | 'createdAt' | 'updatedAt' | 'userAgent' | 'ipAddress' | 'revokedAt' | 'expiresAt'> {}

export class Session extends Model<SessionAttributes, SessionCreationAttributes> implements SessionAttributes {
  public id!: string;
  public userId!: string;
  public refreshToken!: string;
  public userAgent!: string | null;
  public ipAddress!: string | null;
  public expiresAt!: Date;
  public revokedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Session.init(
  {
    id: { type: DataTypes.STRING(50), primaryKey: true },
    userId: { type: DataTypes.STRING(50), allowNull: false },
    refreshToken: { type: DataTypes.TEXT, allowNull: false },
    userAgent: { type: DataTypes.STRING(255), allowNull: true },
    ipAddress: { type: DataTypes.STRING(50), allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'sessions',
    timestamps: true,
    indexes: [{ fields: ['userId'] }, { fields: ['expiresAt'] }],
  }
);