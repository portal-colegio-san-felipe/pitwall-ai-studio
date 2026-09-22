import path from 'path';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  persistenceDir: string;
  defaultLang: 'es';
  appName: string;
  version: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  persistenceDir: path.resolve(process.cwd(), process.env.PERSISTENCE_DIR || './data'),
  defaultLang: 'es',
  appName: 'Pit Wall / Race Control escolar',
  version: '0.1.0'
};
