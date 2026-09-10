/**
 * One-time OAuth 2.0 authorization script.
 *
 * Run this once before starting the MCP server:
 *   npm run auth
 *
 * This will:
 *   1. Print the Google OAuth consent URL
 *   2. Wait for you to paste the authorization code
 *   3. Exchange the code for tokens and save them to GOOGLE_TOKEN_STORAGE
 *
 * After running this script successfully, the MCP server can use the
 * stored tokens for all subsequent API calls without re-authentication.
 */

import { createInterface } from 'node:readline';
import { googleAuthService } from '../services/google-auth-service.js';

async function runAuth(): Promise<void> {
  console.log('\n=== Google Workspace MCP Server — OAuth Setup ===\n');

  const authUrl = googleAuthService.getAuthUrl();

  console.log('Step 1: Open the following URL in your browser to authorize the MCP server:\n');
  console.log(`  ${authUrl}\n`);
  console.log('Step 2: After authorizing, Google will redirect you to a URL like:');
  console.log('  http://localhost:3000/oauth/callback?code=<CODE>&scope=...\n');
  console.log('Step 3: Copy the "code" parameter value from the redirect URL.\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question('Paste the authorization code here: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!code) {
    console.error('\n[Error] No authorization code provided. Aborting.');
    process.exit(1);
  }

  try {
    await googleAuthService.exchangeCode(code);
    console.log('\n✅ Authentication successful! Tokens have been saved.');
    console.log('   You can now start the MCP server with: npm run dev\n');
  } catch (err) {
    console.error('\n[Error] Failed to exchange authorization code:');
    console.error(err instanceof Error ? err.message : String(err));
    console.error('\nPlease try again with a fresh authorization code.\n');
    process.exit(1);
  }
}

runAuth();
