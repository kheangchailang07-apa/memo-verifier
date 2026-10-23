import { Sequelize } from 'sequelize';
import { loadEnv } from './env';

loadEnv();

const sequelize = new Sequelize(
  process.env.DB_NAME as string,
  process.env.DB_USER as string,
  process.env.DB_PASSWORD as string,
  {
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT),
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? false : false,
    timezone: '+08:00',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Where this instance is pointing — printed without the password so a wrong
// env file or host is obvious from the first console line.
const describeConnection = (): string =>
  `${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}` +
  ` | env: ${process.env.ENV_FILE || '.env'} | app port: ${process.env.PORT || '5422'}` +
  ` | node_env: ${process.env.NODE_ENV || 'unset'}`;

export const connectDB = async (): Promise<void> => {
  console.log(`[DB] Connecting to ${describeConnection()}`);
  try {
    await sequelize.authenticate();
    console.log(`[DB] Connection established successfully. -> ${describeConnection()}`);
  } catch (error) {
    console.error(`[DB] Unable to connect to database. -> ${describeConnection()}`);
    console.error('[DB] Error:', error);
    process.exit(1);
  }
};

export default sequelize;
