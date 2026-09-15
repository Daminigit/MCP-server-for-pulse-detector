import { googleAuthService } from '../services/google-auth-service.js';

const code = process.argv[2];
if (!code) {
  console.error('Usage: tsx src/scripts/exchange-code.ts <AUTH_CODE>');
  process.exit(1);
}

try {
  await googleAuthService.exchangeCode(code);
  console.log('✅ Authentication successful! Token saved to .tokens/google-token.json');
  console.log('   You can now start the MCP server with: npm run dev');
} catch (err) {
  console.error('❌ Failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
