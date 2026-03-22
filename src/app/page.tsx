'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRevenue } from '@/hooks/useRevenue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from '@/lib/supabase'
import { 
  Search, 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Activity,
  Calendar,
  DollarSign,
  Users,
  Zap,
  ArrowRight,
  RefreshCw,
  Loader2,
  Target,
  Brain,
  RotateCcw,
  Lightbulb,
  FileText
} from 'lucide-react'

// Types
interface Task {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  urgency: string
  priority: string
  assigned_to: string
  due_date: string | null
  estimated_minutes: number | null
  project_id: string | null
  person: string | null
  google_task_id: string | null
  google_list_name: string | null
  needs_clarity: boolean
  clarity_question: string | null
  source: string
  notes: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  status: string
  created_at: string
}

interface Automation {
  id: string
  name: string
  description: string
  schedule: string
  last_run: string | null
  last_status: string
  enabled: boolean
}

interface Idea {
  id: string
  title: string
  description: string
  category: string
  status: string
  priority: string
  source: string
  created_at: string
}

interface Goal {
  id: string
  title: string
  description: string | null
  level: string
  status: string
  target_value: string
  current_value: string
  target_date: string
  created_at: string
}

interface Decision {
  id: string
  title: string
  description: string | null
  context: string | null
  status: string
  made_at: string
  review_at: string | null
}

interface Loop {
  id: string
  type: string
  title: string
  description: string | null
  stale_since: string
  urgency: string
  status: string
}

interface Capture {
  id: string
  content: string
  type: string
  source: string | null
  processed: boolean
  created_at: string
}

interface PipelineItem {
  id: string
  contact_id: string
  product: string
  stage: string
  monthly_value: number
  probability: number
  next_action: string | null
  next_action_date: string | null
  contacts?: {
    name: string
    email: string | null
  }
}

interface WeeklyPriority {
  id: string
  week_start: string
  priority_1: string | null
  priority_2: string | null
  priority_3: string | null
  notes: string | null
  status: string
  created_at: string
}

// Static data for cron schedule (will be dynamic later)
const cronSchedule = [
  { day: "Mon", jobs: ["6am Email", "10:30am Monday Mindset"] },
  { day: "Tue", jobs: ["Email (3x)", "11am Rapid Rapport"] },
  { day: "Wed", jobs: ["Email (3x)", "11am Rapid Rapport", "1:30pm MJM", "5pm Lead Conv."] },
  { day: "Thu", jobs: ["Email (3x)", "11am Rapid Rapport", "1pm Open Door", "4:30pm NLP"] },
  { day: "Fri", jobs: ["Email (3x)", "3pm UR Post"] },
  { day: "Sat", jobs: ["Minimal"] },
  { day: "Sun", jobs: ["5pm Content", "6pm UR Integration"] },
]

export default function MissionControl() {
  const { revenue, loading: revenueLoading } = useRevenue()
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [captureInput, setCaptureInput] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [clarityResponses, setClarityResponses] = useState<Record<string, string>>({})
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Submit clarification and save to task notes
  const submitClarification = async (taskId: string, response: string) => {
    if (!response.trim()) {
      showToast('Please enter your clarification first', 'error')
      return
    }
    
    try {
      // Save the clarification to the task notes
      const task = tasks.find(t => t.id === taskId)
      const existingNotes = task?.notes || ''
      const timestamp = new Date().toLocaleString()
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n[${timestamp}] Matthew's clarification: ${response}`
        : `[${timestamp}] Matthew's clarification: ${response}`
      
      await supabase
        .from('tasks')
        .update({ 
          notes: newNotes,
          needs_clarity: false,  // Remove from Needs Clarity immediately
          assigned_to: 'aaron', // Assign to Aaron for processing
          status: 'pending_review'
        })
        .eq('id', taskId)
      
      // Log this as an activity
      await supabase.from('activity_feed').insert({
        type: 'clarification',
        title: `Clarification provided: ${task?.title?.substring(0, 50)}...`,
        description: response.substring(0, 200),
        status: 'pending_review'
      })
      
      // Clear the input
      setClarityResponses(prev => ({ ...prev, [taskId]: '' }))
      showToast('✅ Sent to Aaron for processing')
      fetchData()
    } catch (err) {
      console.error('Failed to save clarification:', err)
      showToast('Failed to save clarification', 'error')
    }
  }
  
  // Data from Supabase
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [automations, setAutomations] = useState<Automation[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [scorecard, setScorecard] = useState<any[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loops, setLoops] = useState<Loop[]>([])
  const [captures, setCaptures] = useState<Capture[]>([])
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [weeklyPriorities, setWeeklyPriorities] = useState<WeeklyPriority | null>(null)
  
  // Derived counts from pipeline (fallback if Keap API not available)
  const pipelineCoachingCount = pipeline.filter(p => p.product === '1-on-1 Coaching' && (p.stage === 'CLOSED-WON' || p.stage === 'HOT' || p.stage === 'FOLLOW-UP')).length
  // Use Keap live count when available (tag 5089 = MFI Coaching Client - Current)
  const coachingCount = (revenue?.coaching_clients != null && revenue.coaching_clients > 0)
    ? revenue.coaching_clients
    : pipelineCoachingCount
  // Elevate Intensive count from Keap (tag 10123 = Customer - Elevate Intensive - Current)
  const elevateCount = revenue?.elevate_clients ?? 0
  const aoiCount = pipeline.filter(p => p.product?.toLowerCase().includes('aoi')).reduce((sum, p) => sum + (p.monthly_value || 0), 0)
  const mjmCount = pipeline.filter(p => p.product?.toLowerCase().includes('mjm')).reduce((sum, p) => sum + (p.monthly_value || 0), 0)

  // Fetch data from Supabase
  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch tasks awaiting Matthew
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Fetch activity feed
      const { data: activitiesData } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      // Fetch automations
      const { data: automationsData } = await supabase
        .from('automations')
        .select('*')
        .order('name')
      
      // Fetch ideas
      const { data: ideasData } = await supabase
        .from('ideas')
        .select('*')
        .order('priority', { ascending: true })
      
      // Fetch goals
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .order('level')
      
      // Fetch scorecard
      const { data: scorecardData } = await supabase
        .from('scorecard_weekly')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(1)
      
      // Fetch decisions
      const { data: decisionsData } = await supabase
        .from('decisions')
        .select('*')
        .order('made_at', { ascending: false })
        .limit(10)
      
      // Fetch open loops
      const { data: loopsData } = await supabase
        .from('loops')
        .select('*')
        .eq('status', 'open')
        .order('urgency')
      
      // Fetch recent captures
      const { data: capturesData } = await supabase
        .from('captures')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      
      // Fetch pipeline with contact names
      const { data: pipelineData } = await supabase
        .from('pipeline')
        .select('*, contacts(name, email)')
        .order('probability', { ascending: false })
      
      // Fetch current week's priorities
      const { data: prioritiesData } = await supabase
        .from('weekly_priorities')
        .select('*')
        .eq('status', 'active')
        .order('week_start', { ascending: false })
        .limit(1)
      
      if (tasksData) setTasks(tasksData)
      if (activitiesData) setActivities(activitiesData)
      if (automationsData) setAutomations(automationsData)
      if (ideasData) setIdeas(ideasData)
      if (goalsData) setGoals(goalsData)
      if (scorecardData) setScorecard(scorecardData)
      if (decisionsData) setDecisions(decisionsData)
      if (loopsData) setLoops(loopsData)
      if (capturesData) setCaptures(capturesData)
      if (pipelineData) setPipeline(pipelineData)
      if (prioritiesData && prioritiesData.length > 0) setWeeklyPriorities(prioritiesData[0])
      
    } catch (error) {
      console.error('Error fetching data:', error)
    }
    setLoading(false)
    setLastRefresh(new Date())
  }

  // Quick capture function
  const handleQuickCapture = async () => {
    if (!captureInput.trim()) return
    
    setCapturing(true)
    try {
      const { error } = await supabase
        .from('captures')
        .insert({
          content: captureInput.trim(),
          type: 'note',
          source: 'Mission Control',
          processed: false
        })
      
      if (error) {
        console.error('Error saving capture:', error)
      } else {
        setCaptureInput('')
        fetchData() // Refresh to show new capture
      }
    } catch (err) {
      console.error('Capture failed:', err)
    }
    setCapturing(false)
  }

  // Update task status (for quick actions)
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const statusMessages: Record<string, string> = {
      'done': '✅ Marked complete',
      'scheduled': '📅 Moved to scheduled',
      'someday': '⏸️ Moved to someday/later'
    }
    
    try {
      const updates: Record<string, unknown> = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      }
      
      if (newStatus === 'done') {
        updates.completed_at = new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
      
      if (error) {
        console.error('Error updating task:', error)
        showToast('Failed to update task', 'error')
      } else {
        showToast(statusMessages[newStatus] || 'Task updated')
        fetchData() // Refresh
      }
    } catch (err) {
      console.error('Task update failed:', err)
      showToast('Failed to update task', 'error')
    }
  }

  // Start editing a task
  const startEditTask = (task: Task) => {
    setEditingTask(task.id)
    setEditTitle(task.title)
    setEditNotes(task.notes || '')
  }

  // Save task edits
  const saveTaskEdit = async (taskId: string) => {
    try {
      const timestamp = new Date().toLocaleString()
      const task = tasks.find(t => t.id === taskId)
      
      // Log edit to activity feed
      await supabase.from('activity_feed').insert({
        type: 'task_edit',
        title: `Task edited: ${editTitle.substring(0, 50)}`,
        description: `Matthew updated task. Notes: ${editNotes.substring(0, 100)}...`,
        status: 'completed'
      })
      
      await supabase
        .from('tasks')
        .update({ 
          title: editTitle,
          notes: editNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
      
      setEditingTask(null)
      showToast('✅ Task updated')
      fetchData()
    } catch (err) {
      console.error('Failed to save task edit:', err)
      showToast('Failed to save changes', 'error')
    }
  }

  // Promote task to Do Now (urgent)
  const promoteToDoNow = async (taskId: string) => {
    try {
      await supabase
        .from('tasks')
        .update({ 
          urgency: 'urgent',
          assigned_to: 'matthew',
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
      
      await supabase.from('activity_feed').insert({
        type: 'task_priority',
        title: `Task promoted to Do Now`,
        description: `Matthew prioritized a task`,
        status: 'completed'
      })
      
      showToast('⚡ Added to Do Now')
      fetchData()
    } catch (err) {
      console.error('Failed to promote task:', err)
      showToast('Failed to promote task', 'error')
    }
  }

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchData()

    // Set up real-time subscriptions
    const tasksSubscription = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchData)
      .subscribe()

    const activitiesSubscription = supabase
      .channel('activities-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_feed' }, fetchData)
      .subscribe()

    const goalsSubscription = supabase
      .channel('goals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetchData)
      .subscribe()

    const loopsSubscription = supabase
      .channel('loops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loops' }, fetchData)
      .subscribe()

    return () => {
      tasksSubscription.unsubscribe()
      activitiesSubscription.unsubscribe()
      goalsSubscription.unsubscribe()
      loopsSubscription.unsubscribe()
    }
  }, [])

  // Filter tasks awaiting Matthew - only show if due within 2 days or urgent
  const now = new Date()
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  
  // Helper: normalize assigned_to for case-insensitive comparison
  const assignedTo = (t: Task) => (t.assigned_to || '').toLowerCase()
  
  // Tasks that need Matthew's attention NOW
  const awaitingMatthew = tasks.filter(t => {
    // Must be assigned to Matthew and not done
    if (assignedTo(t) !== 'matthew') return false
    if (t.status === 'done' || t.status === 'killed' || t.status === 'someday') return false
    
    // Always show urgent items
    if (t.urgency === 'urgent') return true
    
    // Show items needing clarity
    if (t.needs_clarity) return true
    
    // Show if due within 2 days
    if (t.due_date) {
      const dueDate = new Date(t.due_date)
      return dueDate <= twoDaysFromNow
    }
    
    return false
  })

  // Priority sort helper: high > medium > low > normal
  const priorityOrder = (p: string) => {
    const m: Record<string, number> = { high: 0, medium: 1, normal: 2, low: 3 }
    return m[(p || 'normal').toLowerCase()] ?? 2
  }

  // "Needs Attention" - Matthew's pending/active/needs_triage tasks only, sorted by priority then newest first
  const needsAttentionTasks = tasks
    .filter(t => 
      ['pending', 'active', 'needs_triage'].includes(t.status) &&
      ['matthew', 'me'].includes(assignedTo(t))
    )
    .sort((a, b) => {
      const pa = priorityOrder(a.priority)
      const pb = priorityOrder(b.priority)
      if (pa !== pb) return pa - pb
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 8)

  // "Aaron's In Progress" - Aaron's high priority active/pending tasks
  const aaronHighPriorityTasks = tasks
    .filter(t =>
      ['aaron'].includes(assignedTo(t)) &&
      ['active', 'pending'].includes(t.status) &&
      t.priority === 'high'
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // "Needs Clarity" - tasks with needs_clarity = true and clarity_question is not null
  const needsClarityTasks = tasks
    .filter(t => t.needs_clarity && t.clarity_question != null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  // All active tasks for Matthew
  const allActiveForMatthew = tasks.filter(t => 
    assignedTo(t) === 'matthew' && 
    !['done', 'killed'].includes(t.status)
  )
  
  // Aaron's tasks by status
  const aaronTasks = tasks.filter(t => 
    assignedTo(t) === 'aaron' && 
    !['done', 'killed'].includes(t.status)
  )
  const aaronQueue = tasks.filter(t => 
    assignedTo(t) === 'aaron' && 
    ['pending', 'active'].includes(t.status) &&
    t.status !== 'in_progress' && t.status !== 'needs_input'
  )
  const aaronInProgress = tasks.filter(t => 
    assignedTo(t) === 'aaron' && 
    t.status === 'in_progress'
  )
  const aaronNeedsMatthew = tasks.filter(t => 
    assignedTo(t) === 'aaron' && 
    (t.status === 'needs_input' || t.needs_clarity)
  )
  const aaronCompleted = tasks.filter(t => 
    assignedTo(t) === 'aaron' && 
    t.status === 'done'
  ).sort((a, b) => new Date(b.completed_at || b.updated_at).getTime() - new Date(a.completed_at || a.updated_at).getTime())
  
  // Completed tasks (all assignees) for Wins view
  const completedTasks = tasks.filter(t => t.status === 'done')
    .sort((a, b) => new Date(b.completed_at || b.updated_at).getTime() - new Date(a.completed_at || a.updated_at).getTime())
  
  // Completed this week
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const completedThisWeek = completedTasks.filter(t => {
    const completedDate = new Date(t.completed_at || t.updated_at)
    return completedDate >= weekAgo
  })
  
  // Tasks needing clarity (all, for backwards compat in Needs Clarity section)
  const needsClarity = tasks.filter(t => t.needs_clarity)

  // Get goals by level
  const northStar = goals.find(g => g.level === 'north_star')
  const quarterlyGoals = goals.filter(g => g.level === 'quarterly')

  // Calculate days until September
  const septemberDate = new Date('2026-09-01')
  const today = new Date()
  const daysUntilSeptember = Math.ceil((septemberDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Parse goals
  const mrrGoal = quarterlyGoals.find(g => g.title.includes('MRR') || g.title.includes('$40k'))
  const clientGoal = quarterlyGoals.find(g => g.title.toLowerCase().includes('client') || g.title.includes('Coaching Clients'))
  const kristenGoal = quarterlyGoals.find(g => g.title.toLowerCase().includes('kristen'))
  
  // Extract numeric values from strings like "$21,666" or "60%"
  const extractNumber = (str: string) => {
    const match = str?.replace(/[$,%]/g, '').match(/[\d.]+/)
    return match ? parseFloat(match[0]) : 0
  }

  const automationGoal = quarterlyGoals.find(g => g.title.toLowerCase().includes('automat'))
  const currentMRR = mrrGoal ? extractNumber(mrrGoal.current_value) : 21666
  const targetMRR = mrrGoal ? extractNumber(mrrGoal.target_value) : 40000
  const currentClients = clientGoal ? extractNumber(clientGoal.current_value) : 6
  const targetClients = clientGoal ? extractNumber(clientGoal.target_value) : 10
  const currentKristenTime = kristenGoal ? extractNumber(kristenGoal.current_value) : 60
  const targetKristenTime = kristenGoal ? extractNumber(kristenGoal.target_value) : 20
  const currentAutomation = automationGoal ? extractNumber(automationGoal.current_value) : 40
  const targetAutomation = automationGoal ? extractNumber(automationGoal.target_value) : 90

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(dateStr)
  }

  // Activity type styling
  const getActivityStyle = (type: string) => {
    const styles: Record<string, { color: string; emoji: string; bg: string }> = {
      zoom: { color: 'text-blue-400', emoji: '🎬', bg: 'bg-blue-950/20 border-blue-800/20' },
      email: { color: 'text-cyan-400', emoji: '📧', bg: 'bg-cyan-950/20 border-cyan-800/20' },
      circle: { color: 'text-violet-400', emoji: '🔮', bg: 'bg-violet-950/20 border-violet-800/20' },
      backup: { color: 'text-emerald-400', emoji: '💾', bg: 'bg-emerald-950/20 border-emerald-800/20' },
      system: { color: 'text-zinc-400', emoji: '⚙️', bg: 'bg-zinc-800/30 border-zinc-700/30' },
      task: { color: 'text-amber-400', emoji: '✅', bg: 'bg-amber-950/20 border-amber-800/20' },
      task_edit: { color: 'text-amber-400', emoji: '✏️', bg: 'bg-amber-950/20 border-amber-800/20' },
      clarification: { color: 'text-amber-300', emoji: '💬', bg: 'bg-amber-950/20 border-amber-800/20' },
      task_priority: { color: 'text-red-400', emoji: '⚡', bg: 'bg-red-950/20 border-red-800/20' },
    }
    return styles[type] || { color: 'text-zinc-400', emoji: '📝', bg: 'bg-zinc-800/20 border-zinc-700/20' }
  }

  // Calculate pipeline stats
  const closedWonPipeline = pipeline.filter(p => p.stage === 'CLOSED-WON')
  const activePipeline = pipeline.filter(p => !['CLOSED-WON', 'CLOSED-LOST'].includes(p.stage))
  const totalPipelineValue = activePipeline.reduce((sum, p) => sum + (p.monthly_value * p.probability / 100), 0)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-100' 
            : 'bg-red-900/90 border border-red-700 text-red-100'
        }`}>
          {toast.message}
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Mission Control</h1>
              <p className="text-xs text-zinc-500">Updated {formatTime(lastRefresh.toISOString())}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder="Search... (⌘K)" 
                className="w-64 pl-10 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-zinc-400" />
              {awaitingMatthew.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                  {awaitingMatthew.length}
                </span>
              )}
            </Button>
            
            {/* Refresh */}
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="command" className="space-y-6">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="command" className="data-[state=active]:bg-zinc-800">
                🎯 Command
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:bg-zinc-800 relative">
                ⚡ Tasks
                <Badge className="ml-2 bg-zinc-700 text-zinc-300 border-zinc-600">
                  {tasks.filter(t => !['done', 'killed'].includes(t.status)).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="aaron" className="data-[state=active]:bg-zinc-800 relative">
                🤖 Aaron
                {aaronNeedsMatthew.length > 0 && (
                  <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {aaronNeedsMatthew.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="week" className="data-[state=active]:bg-zinc-800">
                📊 Pulse
              </TabsTrigger>
              <TabsTrigger value="brain" className="data-[state=active]:bg-zinc-800">
                💡 Capture
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-zinc-800">
                📜 Log
              </TabsTrigger>
            </TabsList>

            {/* ==================== COMMAND TAB (NEW DEFAULT) ==================== */}
            <TabsContent value="command" className="space-y-6">

              {/* ===== THIS WEEK'S TOP 3 ===== */}
              <Card className={`border-t-4 ${weeklyPriorities ? 'bg-zinc-900 border-zinc-800 border-t-amber-500' : 'bg-zinc-900/60 border-zinc-800/60 border-t-zinc-600'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-bold text-white uppercase tracking-wide">This Week&apos;s Top 3</span>
                    {weeklyPriorities && (
                      <Badge className="ml-auto bg-amber-500/20 text-amber-400 text-xs">
                        Week of {new Date(weeklyPriorities.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Badge>
                    )}
                  </div>
                  {weeklyPriorities ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {weeklyPriorities.priority_1 && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-700/40">
                          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold text-black shrink-0">1</div>
                          <div className="text-sm text-zinc-100 font-medium leading-snug">{weeklyPriorities.priority_1}</div>
                        </div>
                      )}
                      {weeklyPriorities.priority_2 && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                          <div className="w-7 h-7 rounded-full bg-zinc-500 flex items-center justify-center text-sm font-bold text-white shrink-0">2</div>
                          <div className="text-sm text-zinc-200 font-medium leading-snug">{weeklyPriorities.priority_2}</div>
                        </div>
                      )}
                      {weeklyPriorities.priority_3 && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                          <div className="w-7 h-7 rounded-full bg-zinc-500 flex items-center justify-center text-sm font-bold text-white shrink-0">3</div>
                          <div className="text-sm text-zinc-200 font-medium leading-snug">{weeklyPriorities.priority_3}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <div className="text-sm text-zinc-400 mb-1">No priorities set for this week</div>
                      <div className="text-xs text-zinc-600">Ask Matthew for this week&apos;s priorities (Sunday cron runs at 8pm PT)</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ===== SEPTEMBER GOALS STRIP ===== */}
              <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-cyan-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Target className="w-5 h-5 text-cyan-500" />
                    <span className="text-sm font-semibold text-white">Am I on track for September 1?</span>
                    <Badge className="ml-auto bg-cyan-500/20 text-cyan-400 text-xs">{daysUntilSeptember} days left</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* $40k MRR Coaching */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">$40k MRR Coaching</span>
                        <span className="text-emerald-400 font-medium">${currentMRR.toLocaleString()}<span className="text-zinc-500">/$40k</span></span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min((currentMRR / targetMRR) * 100, 100)}%` }} />
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{Math.round((currentMRR / targetMRR) * 100)}% complete</div>
                    </div>
                    {/* 15 Coaching Clients */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">{clientGoal?.title ?? '15 Coaching Clients'}</span>
                        <span className="text-cyan-400 font-medium">{currentClients}<span className="text-zinc-500">/{targetClients}</span></span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min((currentClients / targetClients) * 100, 100)}%` }} />
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{Math.round((currentClients / targetClients) * 100)}% complete</div>
                    </div>
                    {/* 90% Admin Automated */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">90% Admin Automated</span>
                        <span className="text-amber-400 font-medium">{currentAutomation}%<span className="text-zinc-500">/{targetAutomation}%</span></span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min((currentAutomation / targetAutomation) * 100, 100)}%` }} />
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{Math.round((currentAutomation / targetAutomation) * 100)}% complete</div>
                    </div>
                    {/* Kristen 20% */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">Kristen → 20% MFI</span>
                        <span className="text-violet-400 font-medium">{currentKristenTime}%<span className="text-zinc-500"> → {targetKristenTime}%</span></span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        {/* Inverted: higher current% means worse, lower is better */}
                        <div className="h-full bg-violet-500 rounded-full transition-all" 
                             style={{ width: `${Math.min(((100 - currentKristenTime) / (100 - targetKristenTime)) * 100, 100)}%` }} />
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{Math.round(((100 - currentKristenTime) / (100 - targetKristenTime)) * 100)}% reduction done</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ===== TOP PROGRESS BOXES (MRR wide, others compact) ===== */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* MTD Revenue - WIDE (2 cols) */}
                <Card className="bg-zinc-900 border-zinc-800 md:col-span-2">
                  <CardContent className="p-4 flex flex-col min-h-[140px]">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-zinc-500 font-semibold">MTD Revenue</span>
                    </div>
                    <div className="text-xs text-zinc-600 mb-2">
                      {revenue?.mtd_month_name ?? new Date().toLocaleString('default', { month: 'long' })} so far
                    </div>
                    <div className="text-3xl font-bold text-white mb-1 break-words">
                      {revenueLoading ? (
                        <span className="text-zinc-500 text-lg">Loading…</span>
                      ) : (revenue?.mtd_revenue != null && revenue.mtd_revenue > 0) ? (
                        <>$<span>{revenue.mtd_revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></>
                      ) : (revenue?.recurring_monthly != null && revenue.recurring_monthly > 0) ? (
                        <>$<span>{revenue.recurring_monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></>
                      ) : (
                        <span className="text-zinc-500 text-lg">—</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500 mb-auto">
                      Goal: $90k–$120k/mo
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full mt-3">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ 
                        width: `${Math.min((((revenue?.mtd_revenue ?? revenue?.recurring_monthly ?? 0) / 90000)) * 100, 100)}%` 
                      }} />
                    </div>
                  </CardContent>
                </Card>

                {/* Coaching Clients */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-4 h-4 text-cyan-500" />
                      <span className="text-xs text-zinc-500">Coaching</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{coachingCount}<span className="text-zinc-500 text-lg">/15</span></div>
                    <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(coachingCount / 15) * 100}%` }} />
                    </div>
                  </CardContent>
                </Card>

                {/* AOI */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Target className="w-4 h-4 text-violet-500" />
                      <span className="text-xs text-zinc-500">AOI</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{aoiCount > 0 ? aoiCount : '~50'}<span className="text-zinc-500 text-lg"> mbrs</span></div>
                    <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${aoiCount > 0 ? Math.min((aoiCount / 60) * 100, 100) : 83}%` }} />
                    </div>
                  </CardContent>
                </Card>

                {/* MJM */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Brain className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-zinc-500">MJM</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{mjmCount > 0 ? mjmCount : '~20'}<span className="text-zinc-500 text-lg"> mbrs</span></div>
                    <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${mjmCount > 0 ? Math.min((mjmCount / 30) * 100, 100) : 67}%` }} />
                    </div>
                  </CardContent>
                </Card>

                {/* Elevate Intensive */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Lightbulb className="w-4 h-4 text-pink-500" />
                      <span className="text-xs text-zinc-500">Elevate</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{elevateCount}<span className="text-zinc-500 text-lg">/30</span></div>
                    <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-pink-500 rounded-full" style={{ width: `${(elevateCount / 30) * 100}%` }} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ===== NEEDS ATTENTION + NEEDS CLARITY (side by side) ===== */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Needs Attention - Matthew's Tasks + Aaron's In Progress */}
                <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-red-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      Needs Attention
                      {needsAttentionTasks.length > 0 && (
                        <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
                          {needsAttentionTasks.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Your tasks + what Aaron is working on</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[320px]">
                      <div className="space-y-4 pr-2">
                        {/* YOUR TASKS (Matthew) */}
                        <div>
                          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            🟢 Your Tasks
                            <span className="text-zinc-500 font-normal normal-case">{needsAttentionTasks.length} pending</span>
                          </div>
                          {needsAttentionTasks.length > 0 ? (
                            <div className="space-y-2">
                              {needsAttentionTasks.map((item) => (
                                <div key={item.id} className={`flex items-start justify-between p-3 rounded-lg border ${
                                  item.priority === 'high' 
                                    ? 'bg-red-950/20 border-red-800/30'
                                    : item.status === 'needs_triage'
                                    ? 'bg-amber-950/20 border-amber-800/30'
                                    : 'bg-zinc-800/50 border-zinc-700'
                                }`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white text-sm leading-snug">{item.title}</div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <Badge variant="outline" className={`text-xs ${
                                        item.status === 'active' ? 'border-blue-700 text-blue-400' :
                                        item.status === 'pending' ? 'border-amber-700 text-amber-400' :
                                        'border-red-700 text-red-400'
                                      }`}>
                                        {item.status}
                                      </Badge>
                                      {item.priority === 'high' && (
                                        <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">high priority</Badge>
                                      )}
                                      {item.source && (
                                        <span className="text-xs text-zinc-500 truncate max-w-[120px]" title={item.source}>
                                          {item.source.length > 30 ? item.source.substring(0, 30) + '…' : item.source}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2 shrink-0">
                                    <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-950/50 h-7 w-7 p-0" onClick={() => updateTaskStatus(item.id, 'done')} title="Done">✅</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                              <div className="text-xs text-zinc-400">All clear! No tasks for you.</div>
                            </div>
                          )}
                        </div>

                        {/* AARON'S IN PROGRESS */}
                        <div>
                          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            🔵 Aaron&apos;s Tasks
                            <span className="text-zinc-500 font-normal normal-case">{aaronHighPriorityTasks.length} high priority</span>
                          </div>
                          {aaronHighPriorityTasks.length > 0 ? (
                            <div className="space-y-2">
                              {aaronHighPriorityTasks.map((item) => (
                                <div key={item.id} className="flex items-start p-3 rounded-lg border bg-cyan-950/20 border-cyan-800/30">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white text-sm leading-snug">{item.title}</div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <Badge variant="outline" className={`text-xs ${
                                        item.status === 'active' ? 'border-blue-700 text-blue-400' :
                                        'border-amber-700 text-amber-400'
                                      }`}>
                                        {item.status}
                                      </Badge>
                                      <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">high priority</Badge>
                                      {item.source && (
                                        <span className="text-xs text-zinc-500 truncate max-w-[120px]" title={item.source}>
                                          {item.source.length > 30 ? item.source.substring(0, 30) + '…' : item.source}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                              <div className="text-xs text-zinc-400">No high-priority tasks in queue.</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Needs Clarity (side-by-side with Needs Attention) */}
                <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-amber-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      Needs Clarity
                      {needsClarityTasks.length > 0 && (
                        <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                          {needsClarityTasks.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Items Aaron couldn&apos;t fully categorize — quick answers needed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[320px]">
                      {needsClarityTasks.length > 0 ? (
                        <div className="space-y-4 pr-2">
                          {needsClarityTasks.map((item) => (
                            <div key={item.id} className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/30">
                              <div className="font-medium text-white mb-2 text-sm">{item.title}</div>
                              {item.clarity_question && (
                                <div className="text-sm text-amber-300 mb-3">❓ {item.clarity_question}</div>
                              )}
                              
                              {/* Clarification input */}
                              <div className="mb-3">
                                <Input
                                  placeholder="Your answer or context..."
                                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 mb-2 text-sm"
                                  value={clarityResponses[item.id] || ''}
                                  onChange={(e) => setClarityResponses(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && clarityResponses[item.id]?.trim()) {
                                      submitClarification(item.id, clarityResponses[item.id])
                                    }
                                  }}
                                />
                                {clarityResponses[item.id]?.trim() && (
                                  <Button
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs w-full"
                                    onClick={() => submitClarification(item.id, clarityResponses[item.id])}
                                  >
                                    💬 Send to Aaron
                                  </Button>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-1 pt-2 border-t border-amber-800/20">
                                <Button size="sm" variant="outline" className="border-emerald-700 text-emerald-400 text-xs hover:bg-emerald-950/50 h-7"
                                  onClick={async () => { await supabase.from('tasks').update({ needs_clarity: false, assigned_to: 'matthew', status: 'active' }).eq('id', item.id); showToast('✅ For Matthew'); fetchData() }}>
                                  🟢 Me
                                </Button>
                                <Button size="sm" variant="outline" className="border-cyan-700 text-cyan-400 text-xs hover:bg-cyan-950/50 h-7"
                                  onClick={async () => { await supabase.from('tasks').update({ needs_clarity: false, assigned_to: 'aaron', status: 'active' }).eq('id', item.id); showToast('✅ For Aaron'); fetchData() }}>
                                  🔵 Aaron
                                </Button>
                                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400 text-xs hover:bg-zinc-800 h-7"
                                  onClick={async () => { await supabase.from('tasks').update({ needs_clarity: false, status: 'someday' }).eq('id', item.id); showToast('⏸️ Later'); fetchData() }}>
                                  ⏸️
                                </Button>
                                <Button size="sm" variant="outline" className="border-red-800 text-red-400 text-xs hover:bg-red-950/50 h-7"
                                  onClick={async () => { await supabase.from('tasks').update({ needs_clarity: false, status: 'killed' }).eq('id', item.id); showToast('🗑️ Killed'); fetchData() }}>
                                  🗑️
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                          <div className="text-sm text-zinc-400">All clear! Everything is categorized.</div>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* ===== SUGGESTED ACTIONS (Daily Shuffle for QS 9) ===== */}
              <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-emerald-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ArrowRight className="w-5 h-5 text-emerald-500" />
                    Suggested Actions
                    <span className="text-xs text-zinc-500 ml-auto">🔀 Refreshed daily</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Pipeline Follow-ups (actual people) */}
                    {activePipeline.slice(0, 3).map((item, idx) => (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg ${
                        idx === 0 ? 'bg-emerald-950/30 border border-emerald-800/30' : 'bg-zinc-800/50 border border-zinc-700'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-emerald-500 text-black' : 'bg-zinc-600 text-white'
                          }`}>{idx + 1}</div>
                          <div>
                            <div className="font-medium text-white text-sm">
                              {item.contacts?.name || 'Unknown'}
                            </div>
                            <div className={`text-xs ${idx === 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                              {item.next_action || `${item.stage} — follow up`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={
                            idx === 0 ? "border-emerald-500/50 text-emerald-400 text-xs" : "border-zinc-600 text-zinc-400 text-xs"
                          }>
                            {item.product}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">📞</Button>
                        </div>
                      </div>
                    ))}

                    {/* Daily Strategic Suggestions (shuffled based on day) */}
                    {(() => {
                      const strategicItems = [
                        { title: "YouTube Authority Content", desc: "Record a Luminary video", badge: "Content", color: "violet" },
                        { title: "Mike D AOI Handoff", desc: "Revenue share discussion", badge: "Strategic", color: "amber" },
                        { title: "Circle Community Post", desc: "Engage with members", badge: "Community", color: "cyan" },
                        { title: "Vision Program Planning", desc: "May launch prep", badge: "Product", color: "pink" },
                        { title: "Vulcan Seven Check-in", desc: "Partnership status", badge: "Partnership", color: "blue" },
                        { title: "Think Big Card Deck", desc: "April launch prep", badge: "Product", color: "orange" },
                      ]
                      // Daily shuffle using day of year as seed
                      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
                      const shuffled = [...strategicItems].sort((a, b) => {
                        const hashA = (a.title.charCodeAt(0) + dayOfYear) % 10
                        const hashB = (b.title.charCodeAt(0) + dayOfYear) % 10
                        return hashA - hashB
                      })
                      const todayItems = shuffled.slice(0, 2)
                      
                      return todayItems.map((item, idx) => (
                        <div key={item.title} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-bold text-white">
                              {activePipeline.slice(0, 3).length + idx + 1}
                            </div>
                            <div>
                              <div className="font-medium text-white text-sm">{item.title}</div>
                              <div className="text-xs text-zinc-400">{item.desc}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className={`border-${item.color}-500/50 text-${item.color}-400 text-xs`}>
                            {item.badge}
                          </Badge>
                        </div>
                      ))
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* WHO NEEDS FOLLOW-UP TODAY + Recent Wins */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Who Needs Follow-up Today */}
                <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      Who Needs Follow-up Today
                      <Badge className="ml-auto bg-zinc-800 text-zinc-400 text-xs">{daysUntilSeptember}d to Sept</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {activePipeline.length > 0 ? activePipeline.slice(0, 5).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-300'
                            }`}>{idx + 1}</div>
                            <div>
                              <div className="text-sm font-medium text-white">{item.contacts?.name || 'Unknown'}</div>
                              <div className="text-xs text-zinc-500">
                                {item.product} • {item.next_action || 'Follow up'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={
                              item.stage === 'MEETING' || item.stage === 'MEETING-BOOKED'
                                ? "border-emerald-500/50 text-emerald-400 text-xs"
                                : item.stage === 'NEGOTIATING' || item.stage === 'PROPOSAL'
                                ? "border-cyan-500/50 text-cyan-400 text-xs"
                                : "border-zinc-600 text-zinc-400 text-xs"
                            }>
                              {item.probability}%
                            </Badge>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:bg-emerald-950/50 text-xs">
                              📞
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-cyan-400 hover:bg-cyan-950/50 text-xs">
                              📧
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-6 text-zinc-500">
                          No active pipeline items. Time to prospect! 🎯
                        </div>
                      )}
                    </div>
                    
                    {/* Pipeline Summary */}
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-800">
                      <div className="text-center">
                        <div className="text-xl font-bold text-emerald-400">${Math.round(totalPipelineValue).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Weighted Value</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-cyan-400">{activePipeline.length}</div>
                        <div className="text-xs text-zinc-500">Active Deals</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Wins */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      Recent Wins 🎉
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {closedWonPipeline.length > 0 ? closedWonPipeline.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/20">
                          <div>
                            <div className="text-sm font-medium text-white">{item.contacts?.name || 'Unknown'}</div>
                            <div className="text-xs text-emerald-400">{item.product}</div>
                          </div>
                          <div className="text-right">
                            {item.monthly_value > 0 && (
                              <div className="text-sm font-bold text-emerald-400">${item.monthly_value.toLocaleString()}/mo</div>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-4 text-zinc-500">Close your first deal! 🎯</div>
                      )}
                    </div>
                    
                    {/* This Month Stats */}
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-400">{closedWonPipeline.length}</div>
                        <div className="text-xs text-zinc-500">Closed This Month</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity + Aaron Status */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity (2/3) */}
                <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="w-5 h-5 text-violet-500" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {activities.slice(0, 8).map((activity) => {
                        const style = getActivityStyle(activity.type)
                        return (
                          <div key={activity.id} className={`flex items-start gap-3 p-2 rounded border ${style.bg} hover:opacity-90 transition-opacity`}>
                            <span className="text-sm shrink-0 pt-0.5">{style.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate">{activity.title}</div>
                              {activity.description && (
                                <div className="text-xs text-zinc-400 truncate">{activity.description}</div>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-xs ${style.color}`}>{activity.type}</div>
                              <div className="text-xs text-zinc-600">{formatRelativeTime(activity.created_at)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* September Score (1/3) */}
                <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-cyan-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="w-5 h-5 text-cyan-500" />
                      September Score
                      <Badge className="ml-auto bg-cyan-500/20 text-cyan-400 text-xs">{daysUntilSeptember}d left</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Overall Score — average of 4 goal completions */}
                    <div className="text-center p-3 rounded-lg bg-gradient-to-r from-cyan-950/50 to-emerald-950/50 border border-cyan-800/30">
                      <div className="text-3xl font-bold text-cyan-400">
                        {Math.round(
                          ((currentMRR / targetMRR) * 25 + 
                          (currentClients / targetClients) * 25 + 
                          (currentAutomation / targetAutomation) * 25 +
                          ((100 - currentKristenTime) / (100 - targetKristenTime)) * 25)
                        )}
                        <span className="text-lg text-zinc-400">/100</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">Transformation Progress</div>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">💰 MTD Rev</span>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(((revenue?.mtd_revenue ?? revenue?.recurring_monthly ?? currentMRR) / targetMRR) * 100, 100)}%` }} />
                          </div>
                          <span className="text-zinc-300 w-16 text-right">${Math.round((revenue?.mtd_revenue ?? revenue?.recurring_monthly ?? currentMRR)/1000)}k/$90k</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">🎯 Clients</span>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min((currentClients / targetClients) * 100, 100)}%` }} />
                          </div>
                          <span className="text-zinc-300 w-16 text-right">{currentClients}/{targetClients}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">🤖 Auto</span>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((currentAutomation / targetAutomation) * 100, 100)}%` }} />
                          </div>
                          <span className="text-zinc-300 w-16 text-right">{currentAutomation}%/{targetAutomation}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">👩 Kristen</span>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(((100 - currentKristenTime) / (100 - targetKristenTime)) * 100, 100)}%` }} />
                          </div>
                          <span className="text-zinc-300 w-16 text-right">{currentKristenTime}%→{targetKristenTime}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== TASKS TAB (FULL LIST) ==================== */}
            <TabsContent value="tasks" className="space-y-6">
              {/* DO NOW - Priority Tasks */}
              <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-emerald-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    ⚡ Do Now
                    <Badge className="ml-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {tasks.filter(t => t.urgency === 'urgent' && assignedTo(t) === 'matthew' && !['done', 'killed', 'someday'].includes(t.status)).length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Your top priorities — click task to edit, buttons to act</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tasks.filter(t => t.urgency === 'urgent' && assignedTo(t) === 'matthew' && !['done', 'killed', 'someday'].includes(t.status)).length > 0 ? (
                      tasks.filter(t => t.urgency === 'urgent' && assignedTo(t) === 'matthew' && !['done', 'killed', 'someday'].includes(t.status)).map((task, idx) => (
                        <div key={task.id} className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
                          {editingTask === task.id ? (
                            /* EDITING MODE */
                            <div className="space-y-2">
                              <Input 
                                value={editTitle} 
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-zinc-800 border-zinc-600 text-white"
                                placeholder="Task title..."
                              />
                              <textarea 
                                value={editNotes} 
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="w-full p-2 rounded bg-zinc-800 border border-zinc-600 text-zinc-300 text-sm min-h-[60px]"
                                placeholder="Add notes..."
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => saveTaskEdit(task.id)}>💾 Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingTask(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            /* VIEW MODE */
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={() => startEditTask(task)}>
                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-black shrink-0 mt-0.5">{idx + 1}</div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-white hover:text-emerald-300 transition-colors">{task.title}</div>
                                  {task.notes && (
                                    <div className="text-xs text-zinc-400 mt-1 p-2 bg-zinc-800/50 rounded">📝 {task.notes}</div>
                                  )}
                                  <div className="text-xs text-zinc-500 mt-1">
                                    {task.person && `${task.person} • `}{task.due_date && `Due ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                    <span className="text-zinc-600 ml-2">Click to edit</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-400 hover:bg-emerald-950/50" onClick={() => updateTaskStatus(task.id, 'done')} title="Mark Done">✓ Done</Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-amber-400 hover:bg-amber-950/50" onClick={() => updateTaskStatus(task.id, 'scheduled')} title="Schedule">📅</Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-zinc-400 hover:bg-zinc-800" onClick={() => updateTaskStatus(task.id, 'someday')} title="Pause">⏸️</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <div className="text-sm text-zinc-400">No urgent tasks! Promote tasks from below.</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ALL TASKS - Expandable Full List */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      📋 All Tasks
                      <Badge variant="outline" className="ml-2 border-zinc-700 text-zinc-400">
                        {tasks.filter(t => !['done', 'killed'].includes(t.status)).length} active
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Input placeholder="Search..." className="w-40 h-8 text-xs bg-zinc-800 border-zinc-700" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-2">
                      {tasks.filter(t => !['done', 'killed'].includes(t.status) && !(t.urgency === 'urgent' && assignedTo(t) === 'matthew')).map(task => (
                        <div key={task.id} className="p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                          {editingTask === task.id ? (
                            /* EDITING MODE */
                            <div className="space-y-2">
                              <Input 
                                value={editTitle} 
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-zinc-900 border-zinc-600 text-white"
                                placeholder="Task title..."
                              />
                              <textarea 
                                value={editNotes} 
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="w-full p-2 rounded bg-zinc-900 border border-zinc-600 text-zinc-300 text-sm min-h-[60px]"
                                placeholder="Add notes..."
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => saveTaskEdit(task.id)}>💾 Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingTask(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            /* VIEW MODE */
                            <div className="flex items-start justify-between group">
                              <div className="flex-1 cursor-pointer" onClick={() => startEditTask(task)}>
                                <div className="flex items-center gap-2">
                                  <span className={task.assigned_to === 'matthew' ? 'text-emerald-400' : 'text-cyan-400'}>
                                    {task.assigned_to === 'matthew' ? '🟢' : '🔵'}
                                  </span>
                                  <span className="text-sm text-white hover:text-cyan-300 transition-colors">{task.title}</span>
                                  <span className="text-xs text-zinc-600 opacity-0 group-hover:opacity-100">✏️ edit</span>
                                </div>
                                {task.notes && (
                                  <div className="text-xs text-zinc-400 mt-1 ml-6 p-2 bg-zinc-900/50 rounded">📝 {task.notes}</div>
                                )}
                                <div className="text-xs text-zinc-500 mt-1 ml-6">
                                  {task.status}{task.person && ` • ${task.person}`}{task.google_list_name && ` • ${task.google_list_name}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:bg-red-950/50 text-xs" onClick={() => promoteToDoNow(task.id)}>
                                  ⚡ Do Now
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:bg-emerald-950/50 text-xs" onClick={() => updateTaskStatus(task.id, 'done')}>✓</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-400 hover:bg-zinc-800 text-xs" onClick={() => updateTaskStatus(task.id, 'someday')}>⏸️</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* COMPLETED - Collapsible */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3 cursor-pointer hover:bg-zinc-800/50 rounded-t-lg transition-colors">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      ✅ Completed
                      <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-400">
                        {completedTasks.length}
                      </Badge>
                    </div>
                    <span className="text-xs text-zinc-500">All tasks preserved</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1 pr-2">
                      {completedTasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-2 rounded bg-emerald-950/10 hover:bg-emerald-950/20 transition-colors">
                          <div className="flex items-center gap-2 flex-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-sm text-zinc-400">{task.title}</span>
                          </div>
                          <span className="text-xs text-zinc-600">{formatRelativeTime(task.completed_at || task.updated_at)}</span>
                        </div>
                      ))}
                      {completedTasks.length === 0 && (
                        <div className="text-center py-4 text-zinc-500">No completed tasks yet</div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="text-center pt-3 border-t border-zinc-800 mt-3">
                    <span className="text-xs text-zinc-500">📦 All {completedTasks.length} completed tasks preserved forever</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== AARON TAB (Simplified) ==================== */}
            <TabsContent value="aaron" className="space-y-6">
              {/* WORKING ON NOW - Big prominent card */}
              <Card className="bg-gradient-to-r from-cyan-950/50 to-zinc-900 border-cyan-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                    Aaron is Working On...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aaronInProgress.length > 0 ? (
                    <div className="space-y-3">
                      {aaronInProgress.map((task) => (
                        <div key={task.id} className="p-4 rounded-lg bg-zinc-900/80 border border-cyan-800/30">
                          <div className="text-lg font-medium text-white">{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-zinc-400 mt-2">{task.description}</div>
                          )}
                          {task.notes && (
                            <div className="text-xs text-cyan-400 mt-2 p-2 bg-cyan-950/30 rounded">📝 {task.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">🤖</div>
                      <div className="text-lg text-zinc-300">Ready for your next task!</div>
                      <div className="text-sm text-zinc-500 mt-1">Assign something via chat or Tasks tab</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* NEEDS YOU */}
                <Card className={`bg-zinc-900 border-zinc-800 ${aaronNeedsMatthew.length > 0 ? 'border-l-4 border-l-amber-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {aaronNeedsMatthew.length > 0 ? (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                      Needs You
                      {aaronNeedsMatthew.length > 0 && (
                        <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                          {aaronNeedsMatthew.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {aaronNeedsMatthew.length > 0 ? (
                      <div className="space-y-2">
                        {aaronNeedsMatthew.map((task) => (
                          <div key={task.id} className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/30">
                            <div className="font-medium text-white text-sm">{task.title}</div>
                            {task.clarity_question && (
                              <div className="text-xs text-amber-300 mt-1">❓ {task.clarity_question}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-sm text-emerald-400">✓ All clear!</div>
                        <div className="text-xs text-zinc-500">Aaron has what he needs</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* QUICK STATS */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Today&apos;s Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                        <div className="text-2xl font-bold text-white">
                          {activities.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length}
                        </div>
                        <div className="text-xs text-zinc-500">Actions</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                        <div className="text-2xl font-bold text-emerald-400">
                          {aaronCompleted.filter(t => {
                            const d = new Date(t.completed_at || t.updated_at)
                            return d.toDateString() === new Date().toDateString()
                          }).length}
                        </div>
                        <div className="text-xs text-zinc-500">Completed</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-zinc-800/50">
                        <div className="text-2xl font-bold text-cyan-400">{aaronQueue.length}</div>
                        <div className="text-xs text-zinc-500">In Queue</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* JUST FINISHED - Last 24h */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Just Finished
                    <span className="text-xs text-zinc-500 ml-auto">Last 24 hours</span>
                  </CardTitle>
                  <CardDescription>What Aaron has finished</CardDescription>
                </CardHeader>
                <CardContent>
                  {aaronCompleted.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {aaronCompleted.slice(0, 15).map((task) => (
                        <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-emerald-950/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-zinc-300 truncate">{task.title}</div>
                            <div className="text-xs text-zinc-500">
                              {formatRelativeTime(task.completed_at || task.updated_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {aaronCompleted.length > 15 && (
                        <div className="text-center pt-2">
                          <span className="text-xs text-zinc-500">+{aaronCompleted.length - 15} more completed</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-sm text-zinc-400">No completed tasks yet</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== PULSE TAB (Week + System Health) ==================== */}
            <TabsContent value="week" className="space-y-6">
              {/* This Week's Wins */}
              <Card className="bg-gradient-to-r from-emerald-950/30 to-zinc-900 border-emerald-800/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    🏆 This Week&apos;s Wins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-zinc-900/80">
                      <div className="text-3xl font-bold text-emerald-400">{completedThisWeek.length}</div>
                      <div className="text-xs text-zinc-500">Tasks Done</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-zinc-900/80">
                      <div className="text-3xl font-bold text-cyan-400">{closedWonPipeline.length}</div>
                      <div className="text-xs text-zinc-500">Deals Closed</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-zinc-900/80">
                      <div className="text-3xl font-bold text-violet-400">
                        {activities.filter(a => {
                          const d = new Date(a.created_at)
                          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          return d >= weekAgo
                        }).length}
                      </div>
                      <div className="text-xs text-zinc-500">Actions</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-zinc-900/80">
                      <div className="text-3xl font-bold text-amber-400">40</div>
                      <div className="text-xs text-zinc-500">Automations</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Focus */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="w-5 h-5 text-amber-500" />
                      Weekly Focus
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {weeklyPriorities ? (
                      <>
                        {weeklyPriorities.priority_1 && (
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-950/30 border border-amber-800/30">
                            <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black shrink-0">1</div>
                            <div className="text-sm text-zinc-200">{weeklyPriorities.priority_1}</div>
                          </div>
                        )}
                        {weeklyPriorities.priority_2 && (
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                            <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-bold text-white shrink-0">2</div>
                            <div className="text-sm text-zinc-200">{weeklyPriorities.priority_2}</div>
                          </div>
                        )}
                        {weeklyPriorities.priority_3 && (
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                            <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-bold text-white shrink-0">3</div>
                            <div className="text-sm text-zinc-200">{weeklyPriorities.priority_3}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-sm text-zinc-400">No priorities set</div>
                        <div className="text-xs text-zinc-500">Sunday — Aaron will ask!</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* System Health */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      💚 System Health
                      <a href="/cron" className="ml-auto">
                        <Button variant="ghost" size="sm" className="text-xs text-zinc-500 hover:text-white">Details →</Button>
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-sm text-zinc-200">Email Sync</div>
                          <div className="text-xs text-zinc-500">3x daily</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-sm text-zinc-200">Calendar</div>
                          <div className="text-xs text-zinc-500">Connected</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-sm text-zinc-200">Circle API</div>
                          <div className="text-xs text-zinc-500">Active</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-sm text-zinc-200">Zoom Upload</div>
                          <div className="text-xs text-zinc-500">6 automations</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-sm text-zinc-200">Keap API</div>
                          <div className="text-xs text-zinc-500">Revenue live</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-sm text-zinc-200">Mission Control</div>
                          <div className="text-xs text-zinc-500">Real-time</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Rhythm */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5 text-cyan-500" />
                    Weekly Rhythm
                  </CardTitle>
                  <a href="/cron">
                    <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:text-white text-xs">
                      Full Schedule →
                    </Button>
                  </a>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {cronSchedule.map((day) => (
                      <div key={day.day} className="text-center">
                        <div className={`font-semibold pb-2 ${day.day === new Date().toLocaleDateString('en-US', { weekday: 'short' }) ? 'text-cyan-400' : 'text-zinc-400'}`}>
                          {day.day}
                        </div>
                        <div className="text-2xl font-bold text-zinc-300">{day.jobs.length}</div>
                        <div className="text-xs text-zinc-500">jobs</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== ACTIVITY LOG TAB ==================== */}
            <TabsContent value="activity">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📜 Activity Feed
                    <Badge variant="outline" className="ml-2 border-zinc-700 text-zinc-500">
                      {activities.length} entries
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Every action Aaron takes, logged for full transparency (Trust Layer)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                      {activities.length > 0 ? activities.map((activity) => {
                        const style = getActivityStyle(activity.type)
                        return (
                          <div key={activity.id} className={`flex gap-4 pb-4 border-b border-zinc-800 last:border-0`}>
                            <div className="shrink-0 pt-0.5 text-xl">{style.emoji}</div>
                            <div className="text-sm text-zinc-500 w-20 shrink-0">
                              <div>{formatRelativeTime(activity.created_at)}</div>
                              <div className="text-xs text-zinc-600">{formatDate(activity.created_at)}</div>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-zinc-200 mb-1">{activity.title}</div>
                              {activity.description && (
                                <div className="text-sm text-zinc-400">{activity.description}</div>
                              )}
                            </div>
                            <Badge variant="outline" className={`shrink-0 ${
                              activity.status === 'completed' 
                                ? "border-emerald-500/30 text-emerald-400"
                                : activity.status === 'failed'
                                ? "border-red-500/30 text-red-400"
                                : "border-zinc-700 text-zinc-500"
                            }`}>
                              <span className={style.color}>{activity.type}</span>
                            </Badge>
                          </div>
                        )
                      }) : (
                        <p className="text-zinc-500 text-center py-8">No activity yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== CAPTURE TAB (Simplified) ==================== */}
            <TabsContent value="brain" className="space-y-6">
              {/* Quick Capture - Prominent at top */}
              <Card className="bg-gradient-to-r from-violet-950/30 to-zinc-900 border-violet-800/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-6 h-6 text-violet-400" />
                    <span className="text-lg font-medium text-white">Quick Capture</span>
                    <span className="text-xs text-zinc-500 ml-auto">Press Enter to save</span>
                  </div>
                  <div className="flex gap-3">
                    <Input 
                      placeholder="💡 Type an idea, insight, or note..."
                      className="flex-1 bg-zinc-900 border-zinc-700 text-zinc-100 text-lg py-6"
                      value={captureInput}
                      onChange={(e) => setCaptureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleQuickCapture()
                        }
                      }}
                    />
                    <Button 
                      className="bg-violet-600 hover:bg-violet-500 px-6"
                      onClick={handleQuickCapture}
                      disabled={capturing || !captureInput.trim()}
                    >
                      {capturing ? '...' : '💾 Save'}
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 text-xs" disabled>
                      🎤 Voice (coming soon)
                    </Button>
                    <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 text-xs" disabled>
                      📎 File (coming soon)
                    </Button>
                    <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 text-xs" disabled>
                      📸 Screenshot (coming soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fresh Captures */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      🆕 Fresh
                      <Badge className="ml-2 bg-violet-500/20 text-violet-400 border-violet-500/30">
                        {captures.filter(c => !c.processed).length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>Unprocessed captures</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2 pr-2">
                        {captures.filter(c => !c.processed).length > 0 ? captures.filter(c => !c.processed).map((capture) => (
                          <div key={capture.id} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                            <div className="text-sm text-zinc-200">{capture.content}</div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-zinc-500">{formatRelativeTime(capture.created_at)}</span>
                              <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                                {capture.type}
                              </Badge>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-6 text-zinc-500">
                            No unprocessed captures
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Recent Decisions */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      📝 Recent Decisions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2 pr-2">
                        {decisions.length > 0 ? decisions.map((decision) => (
                          <div key={decision.id} className="p-3 rounded-lg bg-zinc-800/50">
                            <div className="font-medium text-sm text-white">{decision.title}</div>
                            {decision.description && (
                              <div className="text-xs text-zinc-400 mt-1">{decision.description}</div>
                            )}
                            <div className="text-xs text-zinc-500 mt-2">{formatDate(decision.made_at)}</div>
                          </div>
                        )) : (
                          <div className="text-center py-6 text-zinc-500">
                            No decisions logged yet
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* All Captures */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    💡 All Captures
                    <Badge variant="outline" className="ml-2 border-zinc-700 text-zinc-400">
                      {captures.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-2">
                      {captures.length > 0 ? captures.map((capture) => (
                        <div key={capture.id} className="p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="text-sm text-zinc-300">{capture.content}</div>
                            <Badge variant="outline" className={`ml-2 shrink-0 text-xs ${
                              capture.type === 'idea' ? 'border-cyan-500/50 text-cyan-400' :
                              capture.type === 'insight' ? 'border-violet-500/50 text-violet-400' :
                              'border-zinc-600 text-zinc-400'
                            }`}>
                              {capture.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {formatRelativeTime(capture.created_at)}
                            {capture.source && ` • ${capture.source}`}
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-6 text-zinc-500">
                          No captures yet. Start by typing above!
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        )}
      </main>
    </div>
  )
}
