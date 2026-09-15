import { handleCreateDraft } from '../tools/gmail/create-draft.js';

console.log('🔄 Creating a test Gmail draft...\n');

try {
  const result = await handleCreateDraft({
    to: ['test@example.com'],
    subject: 'MCP Server Test Draft',
    body: 'This is a test draft created by the MCP server to verify Gmail API connectivity.',
  });

  console.log('✅ Draft created successfully!');
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('❌ Failed to create draft:');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
