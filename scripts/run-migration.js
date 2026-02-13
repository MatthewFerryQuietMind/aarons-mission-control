#!/usr/bin/env node
/**
 * Run SQL migrations against Supabase
 * Uses the service role key for admin access
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_mission_control_2.0.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split into individual statements (simple split on semicolons outside of strings)
  // For complex SQL, we'll run chunks
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Running migration with ${statements.length} statements...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) continue;
    
    try {
      // Use rpc to run raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
      
      if (error) {
        // Try alternative: some statements might work directly
        console.log(`Statement ${i + 1}: Attempting via REST...`);
        
        // For CREATE TABLE, we might need to use the management API
        // Let's log and continue
        console.log(`  ⚠️  ${error.message.substring(0, 100)}`);
        errorCount++;
      } else {
        successCount++;
        if (stmt.includes('CREATE TABLE')) {
          const tableName = stmt.match(/CREATE TABLE.*?(\w+)/i)?.[1];
          console.log(`  ✅ Created table: ${tableName || 'unknown'}`);
        } else if (stmt.includes('CREATE INDEX')) {
          console.log(`  ✅ Created index`);
        } else if (stmt.includes('INSERT')) {
          console.log(`  ✅ Inserted data`);
        } else {
          console.log(`  ✅ Statement ${i + 1} executed`);
        }
      }
    } catch (err) {
      console.log(`  ❌ Statement ${i + 1} failed: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} succeeded, ${errorCount} failed`);
  
  // Verify tables exist
  console.log('\nVerifying tables...');
  const tables = ['goals', 'pipeline', 'loops', 'decisions', 'captures', 'calendar_events'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: exists`);
    }
  }
}

runMigration().catch(console.error);
