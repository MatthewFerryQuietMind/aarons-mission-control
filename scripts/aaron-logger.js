#!/usr/bin/env node
/**
 * Aaron Logger - Log actions to Mission Control
 * 
 * Usage: 
 *   node aaron-logger.js activity <type> <title> [description] [status]
 *   node aaron-logger.js loop <type> <title> <description>
 *   node aaron-logger.js capture <type> <content> [source]
 *   node aaron-logger.js decision <title> <description> [context]
 *   node aaron-logger.js pipeline <name> <stage> [deal_value] [notes]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

async function insertRecord(table, data) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert failed: ${error}`);
  }
  
  return response.json();
}

async function logActivity(type, title, description, status = 'completed') {
  const data = {
    type,
    title,
    description,
    status,
    created_at: new Date().toISOString()
  };
  
  const result = await insertRecord('activity_feed', data);
  console.log(`✅ Activity logged: ${title}`);
  return result;
}

async function logLoop(type, title, description, urgency = 'medium') {
  const data = {
    type,
    title,
    description,
    stale_since: new Date().toISOString(),
    urgency,
    status: 'open'
  };
  
  const result = await insertRecord('loops', data);
  console.log(`✅ Loop created: ${title}`);
  return result;
}

async function logCapture(type, content, source = 'chat') {
  const data = {
    type,
    content,
    source,
    processed: false
  };
  
  const result = await insertRecord('captures', data);
  console.log(`✅ Captured: ${content.substring(0, 50)}...`);
  return result;
}

async function logDecision(title, description, context = null) {
  const data = {
    title,
    description,
    context,
    made_at: new Date().toISOString(),
    status: 'active'
  };
  
  const result = await insertRecord('decisions', data);
  console.log(`✅ Decision logged: ${title}`);
  return result;
}

async function updatePipeline(contactName, stage, monthlyValue = null, product = null) {
  // Pipeline uses contact_id - for now just log to activity and note the update needed
  // The existing pipeline schema links to a contacts table
  console.log(`📝 Pipeline update noted: ${contactName} → ${stage}`);
  
  // Log the activity
  await logActivity('crm', `Pipeline: ${contactName}`, `Stage: ${stage}${monthlyValue ? `, Value: $${monthlyValue}` : ''}${product ? `, Product: ${product}` : ''}`);
  
  return { logged: true };
}

async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.log(`
Aaron Logger - Log actions to Mission Control

Usage:
  node aaron-logger.js activity <type> <title> [description] [status]
  node aaron-logger.js loop <type> <title> <description> [urgency]
  node aaron-logger.js capture <type> <content> [source]
  node aaron-logger.js decision <title> <description> [context]
  node aaron-logger.js pipeline <name> <stage> [deal_value] [notes]

Activity types: email, task, crm, loop, decision, calendar, system, capture
Loop types: stalled_task, unanswered_message, incomplete_project, unreviewed_decision, stale_opportunity
Capture types: idea, note, insight, resource, quote, task, question
Pipeline stages: lead, contacted, meeting_booked, proposal, negotiation, closed_won, closed_lost
    `);
    process.exit(0);
  }
  
  try {
    switch (command) {
      case 'activity':
        await logActivity(args[0], args[1], args[2], args[3]);
        break;
      case 'loop':
        await logLoop(args[0], args[1], args[2], args[3]);
        break;
      case 'capture':
        await logCapture(args[0], args[1], args[2]);
        break;
      case 'decision':
        await logDecision(args[0], args[1], args[2]);
        break;
      case 'pipeline':
        await updatePipeline(args[0], args[1], args[2], args[3]);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
