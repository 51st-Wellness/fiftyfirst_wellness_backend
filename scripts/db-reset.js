#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔄 Resetting Turso database...\n');

// Reset database
console.log('🗑️  Resetting database...');
try {
  execSync('pnpm prisma db push --force-reset', { stdio: 'inherit' });
  console.log('✅ Database reset successfully');
} catch (error) {
  console.error('❌ Failed to reset database:', error.message);
  process.exit(1);
}

console.log('\n🎉 Database reset completed!');
console.log('\n📋 Next steps:');
console.log('1. Run "pnpm dev" to start the development server');
console.log('2. Check the console for database connection status');
