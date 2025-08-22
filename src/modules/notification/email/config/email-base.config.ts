import { config } from 'dotenv';
config();
export const EmailBaseConfig = {
  companyName: process.env.COMPANY_NAME,
  companyEmail: process.env.COMPANY_EMAIL,
};
