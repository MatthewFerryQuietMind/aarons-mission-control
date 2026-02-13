#!/usr/bin/env node
/**
 * Set up Mission Control 2.0 tables via Supabase REST API
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

async function executeSql(sql) {
  // Supabase provides a SQL endpoint at /rest/v1/
  // But for DDL, we need to use the Postgres connection or the dashboard
  // Let's try using the rpc endpoint if there's a function
  
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    throw new Error(`SQL execution failed: ${response.status}`);
  }
  
  return response.json();
}

async function checkTableExists(tableName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=id&limit=1`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    }
  });
  return response.ok;
}

async function createTable(tableName, schema) {
  // Since we can't run DDL via REST, we'll check if table exists
  // and log what needs to be created
  const exists = await checkTableExists(tableName);
  if (exists) {
    console.log(`✅ ${tableName}: already exists`);
    return true;
  } else {
    console.log(`❌ ${tableName}: needs to be created`);
    return false;
  }
}

async function insertData(tableName, data) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert failed: ${error}`);
  }
  return true;
}

async function main() {
  console.log('Mission Control 2.0 - Database Setup\n');
  console.log('Checking existing tables...\n');
  
  const tables = ['goals', 'goal_reviews', 'pipeline', 'loops', 'decisions', 'captures', 'calendar_events'];
  const existingTables = [];
  const missingTables = [];
  
  for (const table of tables) {
    const exists = await checkTableExists(table);
    if (exists) {
      existingTables.push(table);
      console.log(`✅ ${table}`);
    } else {
      missingTables.push(table);
      console.log(`❌ ${table} (needs creation)`);
    }
  }
  
  if (missingTables.length > 0) {
    console.log('\n⚠️  Some tables need to be created.');
    console.log('Please run the following SQL in the Supabase Dashboard SQL Editor:');
    console.log('\nhttps://supabase.com/dashboard/project/zaftqupxuuirnegmyznk/sql/new\n');
    console.log('SQL file location: supabase/migrations/001_mission_control_2.0.sql');
    return false;
  }
  
  console.log('\n✅ All tables exist!');
  
  // Check if we need to seed data
  const goalsResponse = await fetch(`${supabaseUrl}/rest/v1/goals?select=id&limit=1`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    }
  });
  const goalsData = await goalsResponse.json();
  
  if (!goalsData || goalsData.length === 0) {
    console.log('\nSeeding initial goals...');
    
    // Insert North Star goal
    const northStar = {
      title: 'September Transformation',
      description: 'Reduce to boutique model: Kristen 20%, Matthew 30%, $40k MRR',
      level: 'north_star',
      status: 'active',
      target_value: 100,
      current_value: 68,
      unit: 'percent',
      target_date: '2026-09-01'
    };
    
    await insertData('goals', northStar);
    console.log('  ✅ North Star goal created');
    
    // Get the north star ID
    const nsResponse = await fetch(`${supabaseUrl}/rest/v1/goals?level=eq.north_star&select=id`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    });
    const nsData = await nsResponse.json();
    const northStarId = nsData[0]?.id;
    
    // Insert quarterly goals
    const quarterlyGoals = [
      {
        title: '$40k Monthly Recurring Revenue',
        description: 'Reach $40,000 MRR through coaching + mastermind',
        level: 'quarterly',
        status: 'active',
        target_value: 40000,
        current_value: 21666,
        unit: 'dollars',
        target_date: '2026-06-30',
        parent_goal_id: northStarId
      },
      {
        title: '10 Coaching Clients',
        description: 'Fill coaching roster to 10 active clients at $4k/month',
        level: 'quarterly',
        status: 'active',
        target_value: 10,
        current_value: 6,
        unit: 'clients',
        target_date: '2026-06-30',
        parent_goal_id: northStarId
      },
      {
        title: 'Kristen to 20% Time',
        description: "Reduce Kristen's MFI involvement to 20% of her time",
        level: 'quarterly',
        status: 'active',
        target_value: 20,
        current_value: 35,
        unit: 'percent',
        target_date: '2026-09-01',
        parent_goal_id: northStarId
      }
    ];
    
    for (const goal of quarterlyGoals) {
      await insertData('goals', goal);
      console.log(`  ✅ ${goal.title}`);
    }
  } else {
    console.log('\nGoals already seeded.');
  }
  
  // Check pipeline
  const pipelineResponse = await fetch(`${supabaseUrl}/rest/v1/pipeline?select=id&limit=1`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    }
  });
  const pipelineData = await pipelineResponse.json();
  
  if (!pipelineData || pipelineData.length === 0) {
    console.log('\nSeeding pipeline data...');
    
    const prospects = [
      {
        name: 'Nikolaj Albinus',
        stage: 'meeting_booked',
        deal_value: 4000,
        deal_type: 'coaching',
        probability: 70,
        next_action: 'Discovery call',
        next_action_date: '2026-02-16',
        notes: 'Booked for Sun 9:30am'
      },
      {
        name: 'Jeff Beggins',
        stage: 'meeting_booked',
        deal_value: 4000,
        deal_type: 'coaching',
        probability: 70,
        next_action: 'Discovery call',
        next_action_date: '2026-02-17',
        notes: 'Booked for Monday'
      },
      {
        name: 'Johan Wedellsborg',
        stage: 'contacted',
        deal_value: 0,
        deal_type: 'partnership',
        probability: 50,
        next_action: 'Follow up - no response 5 days',
        next_action_date: '2026-02-14',
        notes: 'Sent times, waiting for response'
      },
      {
        name: 'Mark Thompson',
        stage: 'lead',
        deal_value: 0,
        deal_type: 'mastermind',
        probability: 30,
        next_action: 'Initial outreach',
        notes: 'Interested in mastermind'
      }
    ];
    
    for (const prospect of prospects) {
      await insertData('pipeline', prospect);
      console.log(`  ✅ ${prospect.name}`);
    }
  } else {
    console.log('\nPipeline already seeded.');
  }
  
  console.log('\n✅ Database setup complete!');
  return true;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
