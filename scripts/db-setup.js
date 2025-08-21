#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Turso database with Prisma...\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env-example...');
  try {
    fs.copyFileSync(path.join(process.cwd(), '.env-example'), envPath);
    console.log('✅ .env file created successfully');
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
    process.exit(1);
  }
}

// Generate Prisma client
console.log('\n🔧 Generating Prisma client...');
try {
  execSync('pnpm prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated successfully');
} catch (error) {
  console.error('❌ Failed to generate Prisma client:', error.message);
  process.exit(1);
}

// Push schema to database
console.log('\n📊 Pushing schema to database...');
try {
  execSync('pnpm prisma db push', { stdio: 'inherit' });
  console.log('✅ Schema pushed to database successfully');
} catch (error) {
  console.error('❌ Failed to push schema:', error.message);
  console.log('\n💡 Make sure your DATABASE_URL is correctly set in .env file');
  process.exit(1);
}

console.log('\n🎉 Database setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Verify your .env file has the correct DATABASE_URL');
console.log('2. Run "pnpm dev" to start the development server');
console.log('3. Check the console for database connection status');
