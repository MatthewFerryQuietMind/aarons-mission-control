import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Seed Activity Feed with recent actions
  const activities = [
    { type: 'dashboard', title: 'Mission Control deployed', description: 'Built and deployed to Vercel: aarons-mission-control.vercel.app', status: 'completed' },
    { type: 'analysis', title: 'Chat history analyzed', description: '1,292 messages from Feb 3-13 analyzed, 50+ accomplishments documented', status: 'completed' },
    { type: 'upload', title: 'NLP Boot Camp Call #5 uploaded', description: 'Posted to Circle AOI - ☎️ NLP+ Live Zoom Call space', status: 'completed' },
    { type: 'email', title: 'Ed Doucet summary sent', description: 'Coaching session summary email sent from aaron@matthewferry.com', status: 'completed' },
    { type: 'download', title: 'Open Door Coaching saved', description: 'Downloaded 982MB recording and uploaded to Google Drive', status: 'completed' },
    { type: 'cron', title: 'Cron jobs updated', description: 'Combined 6am jobs, combined Monday Mindset jobs, updated NLP Boot Camp space', status: 'completed' },
    { type: 'pipeline', title: 'Pipeline updated', description: 'Ed Doucet moved to Current Client (closed!), Johan Wedellsborg added as prospect', status: 'completed' },
    { type: 'email_triage', title: 'Email triage (5pm)', description: '2 high priority, 8 archived - Inbox at zero', status: 'completed' },
    { type: 'upload', title: 'Rapid Rapport uploaded', description: 'Feb 12 recording posted to Circle AOI', status: 'completed' },
    { type: 'document', title: 'Cron Jobs audit doc created', description: 'Google Doc with all 25 cron jobs for Matthew review', status: 'completed' },
  ]

  // Seed Tasks
  const tasks = [
    { title: 'Wire Supabase to Mission Control', description: 'Connect live data to dashboard', status: 'in_progress', priority: 'high', assigned_to: 'aaron' },
    { title: 'Activity feed logging', description: 'Log every action automatically to Supabase', status: 'pending', priority: 'high', assigned_to: 'aaron' },
    { title: 'Global search implementation', description: 'Search across memory, docs, and tasks', status: 'pending', priority: 'normal', assigned_to: 'aaron' },
    { title: 'Review NLP webinar content', description: 'Webinar needs to be ready by Feb 20, ads by Feb 23', status: 'pending', priority: 'high', assigned_to: 'matthew' },
    { title: 'Book NYC trip', description: 'Scottie Friedman Bar Mitzvah - April 17-20', status: 'pending', priority: 'normal', assigned_to: 'matthew' },
  ]

  // Seed Automations
  const automations = [
    { name: '6am Morning Sync', description: 'Combined brief + tasks + email triage', schedule: 'Daily 6am PT', last_status: 'success', enabled: true },
    { name: 'Monday Mindset Upload', description: 'Download from Zoom, upload to MJM + AOI', schedule: 'Mon 10:30am PT', last_status: 'success', enabled: true },
    { name: 'Rapid Rapport (Tue)', description: 'Upload to AOI Circle', schedule: 'Tue 11am PT', last_status: 'success', enabled: true },
    { name: 'Rapid Rapport (Wed)', description: 'Upload to AOI Circle', schedule: 'Wed 11am PT', last_status: 'success', enabled: true },
    { name: 'Rapid Rapport (Thu)', description: 'Upload to AOI Circle', schedule: 'Thu 11am PT', last_status: 'success', enabled: true },
    { name: 'MJM Wednesday Mastermind', description: 'Upload to MJM Circle', schedule: 'Wed 1:30pm PT', last_status: 'success', enabled: true },
    { name: 'Lead Conversion Live', description: 'Upload to AOI Circle', schedule: 'Wed 5pm PT', last_status: 'success', enabled: true },
    { name: 'Open Door Coaching', description: 'Save to Google Drive (private)', schedule: 'Thu 1pm PT', last_status: 'success', enabled: true },
    { name: 'NLP Boot Camp', description: 'Upload to ☎️ NLP+ Live Zoom Call', schedule: 'Thu 4:30pm PT', last_status: 'success', enabled: true },
    { name: 'Email Triage (12pm)', description: 'Process inbox, categorize emails', schedule: 'Daily 12pm PT', last_status: 'success', enabled: true },
    { name: 'Email Triage (5pm)', description: 'Process inbox, categorize emails', schedule: 'Daily 5pm PT', last_status: 'success', enabled: true },
    { name: 'Nightly Autonomous Work', description: 'Execute one task from Aaron list', schedule: 'Daily 12am PT', last_status: 'success', enabled: true },
    { name: 'Weekly Content Planning', description: 'Draft next week UR posts', schedule: 'Sun 5pm PT', last_status: 'pending', enabled: true },
  ]

  // Insert data
  const { error: activityError } = await supabase.from('activity_feed').insert(activities)
  const { error: taskError } = await supabase.from('tasks').insert(tasks)
  const { error: autoError } = await supabase.from('automations').insert(automations)

  if (activityError || taskError || autoError) {
    return NextResponse.json({ 
      error: 'Failed to seed', 
      details: { activityError, taskError, autoError } 
    }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Database seeded successfully!' })
}
