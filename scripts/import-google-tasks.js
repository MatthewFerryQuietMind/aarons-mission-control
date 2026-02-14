#!/usr/bin/env node
/**
 * Import Google Tasks into Mission Control
 * Processes and categorizes tasks from Google Tasks lists
 */

const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Google Tasks lists to import
const LISTS = [
  { id: 'R1VDSll3dGhaSXB2VEtOdg', name: '🔴 INBOX', defaultStatus: 'inbox' },
  { id: 'WnBMeld0RmJIVHN3akZxaA', name: '🟢 MATTHEW', defaultAssigned: 'matthew', defaultStatus: 'active' },
  { id: 'ZXpMNnptckxGWXZjQTVfTg', name: '🔵 AARON', defaultAssigned: 'aaron', defaultStatus: 'active' },
  { id: 'dDJnMk82cEJ1ZmJBYl95dw', name: '⏸️ LATER', defaultStatus: 'someday' },
];

// Project keyword mapping
const PROJECT_KEYWORDS = {
  'neuromed': 'NeuroMed',
  'tinnitus': 'NeuroMed',
  'healthie': 'NeuroMed',
  'cbt': 'NeuroMed',
  'aoi': 'AOI',
  'academy': 'AOI',
  'mjm': 'MJM',
  'mastermind': 'MJM',
  'mission control': 'Mission Control',
  'dashboard': 'Mission Control',
  'aaron': 'Mission Control',
  'openclaw': 'Mission Control',
  'book': 'Book',
  'enlighten': 'Book',
  'qmel': 'Book',
  'sky oak': 'Sky Oak',
  'bungalow': 'Sky Oak',
  'marketing': 'Marketing',
  'linkedin': 'Marketing',
  'content': 'Marketing',
  'webinar': 'Marketing',
  'nlp': 'MFI Operations',
  'circle': 'MFI Operations',
  'zoom': 'MFI Operations',
};

// Detect urgency from title
function detectUrgency(title) {
  const lower = title.toLowerCase();
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('🔴')) return 'urgent';
  if (lower.includes('important') || lower.includes('priority')) return 'high';
  return 'normal';
}

// Detect type from title
function detectType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('decision') || lower.includes('decide')) return 'decision';
  if (lower.includes('research') || lower.includes('investigate') || lower.includes('figure out')) return 'research';
  if (lower.includes('discuss') || lower.includes('talk') || lower.includes('ask')) return 'discussion';
  if (lower.includes('idea') || lower.includes('maybe') || lower.includes('consider')) return 'idea';
  return 'task';
}

// Detect project from title
function detectProject(title) {
  const lower = title.toLowerCase();
  for (const [keyword, project] of Object.entries(PROJECT_KEYWORDS)) {
    if (lower.includes(keyword)) return project;
  }
  return null;
}

// Detect person from title
function detectPerson(title) {
  const people = ['scottie', 'kristen', 'eli', 'ciji', 'amanda', 'lucas', 'emil'];
  const lower = title.toLowerCase();
  for (const person of people) {
    if (lower.includes(person)) return person.charAt(0).toUpperCase() + person.slice(1);
  }
  return null;
}

// Check if task needs clarity
function needsClarity(title, listName) {
  // If in inbox and we can't determine assignment, needs clarity
  if (listName === '🔴 INBOX') {
    const lower = title.toLowerCase();
    // If it mentions Aaron, it's clear
    if (lower.includes('aaron')) return { needs: false };
    // If it's a question or vague, needs clarity
    if (lower.includes('?') || lower.includes('should we') || lower.includes('maybe')) {
      return { needs: true, question: 'Is this for Matthew or Aaron? What\'s the priority?' };
    }
  }
  return { needs: false };
}

async function getProjects() {
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?select=id,name`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    }
  });
  return response.json();
}

async function insertTask(task) {
  const response = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(task)
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to insert task: ${error}`);
    return null;
  }
  return response.json();
}

async function checkExisting(googleTaskId) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/tasks?google_task_id=eq.${googleTaskId}&select=id`,
    {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    }
  );
  const data = await response.json();
  return data && data.length > 0;
}

async function importList(list) {
  console.log(`\n📥 Importing from ${list.name}...`);
  
  try {
    const output = execSync(
      `gog tasks list ${list.id} --account mf@matthewferry.com --json`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    const data = JSON.parse(output);
    const tasks = data.tasks || [];
    
    console.log(`   Found ${tasks.length} tasks`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const task of tasks) {
      // Skip completed tasks
      if (task.status === 'completed') {
        skipped++;
        continue;
      }
      
      // Check if already imported
      const exists = await checkExisting(task.id);
      if (exists) {
        skipped++;
        continue;
      }
      
      // Process the task
      const clarity = needsClarity(task.title, list.name);
      const projectName = detectProject(task.title);
      
      const newTask = {
        title: task.title,
        description: task.notes || null,
        type: detectType(task.title),
        assigned_to: list.defaultAssigned || (task.title.toLowerCase().includes('aaron') ? 'aaron' : 'matthew'),
        status: clarity.needs ? 'needs_clarity' : (list.defaultStatus || 'active'),
        urgency: detectUrgency(task.title),
        due_date: task.due ? task.due.split('T')[0] : null,
        google_task_id: task.id,
        google_list_name: list.name,
        needs_clarity: clarity.needs,
        clarity_question: clarity.question || null,
        source: 'google_tasks',
        person: detectPerson(task.title),
      };
      
      // Link to project if detected
      if (projectName && projects[projectName]) {
        newTask.project_id = projects[projectName];
      }
      
      const result = await insertTask(newTask);
      if (result) {
        imported++;
        console.log(`   ✅ ${task.title.substring(0, 50)}...`);
      }
    }
    
    console.log(`   📊 Imported: ${imported}, Skipped: ${skipped}`);
    return imported;
    
  } catch (err) {
    console.error(`   ❌ Error importing ${list.name}: ${err.message}`);
    return 0;
  }
}

// Global projects map
let projects = {};

async function main() {
  console.log('🚀 Google Tasks → Mission Control Import\n');
  
  // Load projects
  const projectList = await getProjects();
  for (const p of projectList) {
    projects[p.name] = p.id;
  }
  console.log(`📁 Loaded ${Object.keys(projects).length} projects`);
  
  let totalImported = 0;
  
  for (const list of LISTS) {
    const count = await importList(list);
    totalImported += count;
  }
  
  console.log(`\n✅ Import complete! ${totalImported} tasks imported.`);
}

main().catch(console.error);
