'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [captureInput, setCaptureInput] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [clarityResponses, setClarityResponses] = useState<Record<string, string>>({})

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
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loops, setLoops] = useState<Loop[]>([])
  const [captures, setCaptures] = useState<Capture[]>([])
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [weeklyPriorities, setWeeklyPriorities] = useState<WeeklyPriority | null>(null)

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
  
  // Tasks that need Matthew's attention NOW
  const awaitingMatthew = tasks.filter(t => {
    // Must be assigned to Matthew and not done
    if (t.assigned_to !== 'matthew') return false
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
  
  // All active tasks for Matthew
  const allActiveForMatthew = tasks.filter(t => 
    t.assigned_to === 'matthew' && 
    !['done', 'killed'].includes(t.status)
  )
  
  // Aaron's tasks by status
  const aaronTasks = tasks.filter(t => 
    t.assigned_to === 'aaron' && 
    !['done', 'killed'].includes(t.status)
  )
  const aaronQueue = tasks.filter(t => 
    t.assigned_to === 'aaron' && 
    ['pending', 'active'].includes(t.status) &&
    t.status !== 'in_progress' && t.status !== 'needs_input'
  )
  const aaronInProgress = tasks.filter(t => 
    t.assigned_to === 'aaron' && 
    t.status === 'in_progress'
  )
  const aaronNeedsMatthew = tasks.filter(t => 
    t.assigned_to === 'aaron' && 
    (t.status === 'needs_input' || t.needs_clarity)
  )
  const aaronCompleted = tasks.filter(t => 
    t.assigned_to === 'aaron' && 
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
  
  // Tasks needing clarity
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
  const clientGoal = quarterlyGoals.find(g => g.title.includes('Client') || g.title.includes('10'))
  const kristenGoal = quarterlyGoals.find(g => g.title.toLowerCase().includes('kristen'))
  
  // Extract numeric values from strings like "$21,666" or "60%"
  const extractNumber = (str: string) => {
    const match = str?.replace(/[$,%]/g, '').match(/[\d.]+/)
    return match ? parseFloat(match[0]) : 0
  }

  const currentMRR = mrrGoal ? extractNumber(mrrGoal.current_value) : 21666
  const targetMRR = 40000
  const currentClients = clientGoal ? extractNumber(clientGoal.current_value) : 6
  const targetClients = 10
  const currentKristenTime = kristenGoal ? extractNumber(kristenGoal.current_value) : 60
  const targetKristenTime = 20

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
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(dateStr)
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
                📋 Tasks
                <Badge className="ml-2 bg-zinc-700 text-zinc-300 border-zinc-600">
                  {tasks.filter(t => !['done', 'killed'].includes(t.status)).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="aaron" className="data-[state=active]:bg-zinc-800 relative">
                🤖 Aaron
                {tasks.filter(t => t.assigned_to === 'aaron' && t.status === 'needs_input').length > 0 && (
                  <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {tasks.filter(t => t.assigned_to === 'aaron' && t.status === 'needs_input').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="week" className="data-[state=active]:bg-zinc-800">
                📊 This Week
              </TabsTrigger>
              <TabsTrigger value="automation" className="data-[state=active]:bg-zinc-800">
                🤖 Automation
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-zinc-800">
                📜 Activity
              </TabsTrigger>
              <TabsTrigger value="brain" className="data-[state=active]:bg-zinc-800">
                🧠 Second Brain
              </TabsTrigger>
            </TabsList>

            {/* ==================== COMMAND TAB (NEW DEFAULT) ==================== */}
            <TabsContent value="command" className="space-y-6">
              {/* Needs You Now */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Needs You Now
                    {awaitingMatthew.length > 0 && (
                      <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
                        {awaitingMatthew.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {awaitingMatthew.length > 0 ? (
                    <div className="space-y-3">
                      {awaitingMatthew.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                          <div className="flex-1">
                            <div className="font-medium text-white">{item.title}</div>
                            <div className="text-sm text-zinc-400">{item.description}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="outline" className={
                              item.urgency === "urgent" 
                                ? "border-red-500/50 text-red-400" 
                                : item.urgency === "high"
                                ? "border-amber-500/50 text-amber-400"
                                : "border-zinc-600 text-zinc-400"
                            }>
                              {item.urgency}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50"
                              onClick={() => updateTaskStatus(item.id, 'done')}
                              title="Mark Done"
                            >
                              ✅
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/50"
                              onClick={() => updateTaskStatus(item.id, 'scheduled')}
                              title="Schedule for Later"
                            >
                              📅
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"
                              onClick={() => updateTaskStatus(item.id, 'someday')}
                              title="Move to Someday"
                            >
                              ⏸️
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <div className="text-lg font-medium text-white">All clear!</div>
                      <div className="text-sm text-zinc-400">Nothing needs your attention right now.</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Needs Clarity */}
              <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-amber-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    Needs Clarity
                    {needsClarity.length > 0 && (
                      <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {needsClarity.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Items Aaron couldn&apos;t fully categorize — quick answers needed</CardDescription>
                </CardHeader>
                <CardContent>
                  {needsClarity.length > 0 ? (
                    <div className="space-y-4">
                      {needsClarity.map((item) => (
                        <div key={item.id} className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/30">
                          <div className="font-medium text-white mb-2">{item.title}</div>
                          {item.clarity_question && (
                            <div className="text-sm text-amber-300 mb-3">❓ {item.clarity_question}</div>
                          )}
                          
                          {/* Clarification input */}
                          <div className="mb-3">
                            <Input
                              placeholder="Your answer or context..."
                              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 mb-2"
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
                                💬 Send Clarification to Aaron
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-800/20">
                            <span className="text-xs text-zinc-500 w-full mb-1">Or quick action:</span>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-emerald-700 text-emerald-400 text-xs hover:bg-emerald-950/50"
                              onClick={async () => {
                                await supabase.from('tasks').update({ needs_clarity: false, assigned_to: 'matthew', status: 'active' }).eq('id', item.id)
                                showToast('✅ Assigned to Matthew')
                                fetchData()
                              }}
                            >
                              🟢 For Me
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-cyan-700 text-cyan-400 text-xs hover:bg-cyan-950/50"
                              onClick={async () => {
                                await supabase.from('tasks').update({ needs_clarity: false, assigned_to: 'aaron', status: 'active' }).eq('id', item.id)
                                showToast('✅ Assigned to Aaron')
                                fetchData()
                              }}
                            >
                              🔵 For Aaron
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-zinc-700 text-zinc-400 text-xs hover:bg-zinc-800"
                              onClick={async () => {
                                await supabase.from('tasks').update({ needs_clarity: false, status: 'someday' }).eq('id', item.id)
                                showToast('⏸️ Moved to Someday')
                                fetchData()
                              }}
                            >
                              ⏸️ Later
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-red-800 text-red-400 text-xs hover:bg-red-950/50"
                              onClick={async () => {
                                await supabase.from('tasks').update({ needs_clarity: false, status: 'killed' }).eq('id', item.id)
                                showToast('🗑️ Task killed')
                                fetchData()
                              }}
                            >
                              🗑️ Kill
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
                </CardContent>
              </Card>

              {/* September Countdown + Pipeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* September Transformation */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="w-5 h-5 text-cyan-500" />
                      September Transformation
                    </CardTitle>
                    <CardDescription>{daysUntilSeptember} days remaining</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Overall Progress */}
                    <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-950/50 to-emerald-950/50 border border-cyan-800/30">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-zinc-300">Overall Progress</span>
                        <span className="text-sm font-bold text-cyan-400">
                          {Math.round((currentMRR / targetMRR) * 50 + (currentClients / targetClients) * 50)}%
                        </span>
                      </div>
                      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.round((currentMRR / targetMRR) * 50 + (currentClients / targetClients) * 50)}%` }}
                        />
                      </div>
                    </div>

                    {/* MRR */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">Monthly Revenue</span>
                        <span className="text-white">${currentMRR.toLocaleString()} / ${targetMRR.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(currentMRR / targetMRR) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Clients */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">Coaching Clients</span>
                        <span className="text-white">{currentClients} / {targetClients}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${(currentClients / targetClients) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Kristen Time */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">Kristen&apos;s Time in MFI</span>
                        <span className="text-white">{currentKristenTime}% → {targetKristenTime}% goal</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${currentKristenTime}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Need to reduce by {currentKristenTime - targetKristenTime}%</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Hot Pipeline */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      Hot Pipeline
                    </CardTitle>
                    <CardDescription>
                      ${Math.round(totalPipelineValue).toLocaleString()} weighted value
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {activePipeline.length > 0 ? activePipeline.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                          <div>
                            <div className="text-sm font-medium text-white">{item.contacts?.name || 'Unknown'}</div>
                            <div className="text-xs text-zinc-500">{item.product} • {item.stage}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={
                              item.stage === 'MEETING' || item.stage === 'MEETING-BOOKED'
                                ? "border-emerald-500/50 text-emerald-400"
                                : item.stage === 'NEGOTIATING' || item.stage === 'PROPOSAL'
                                ? "border-cyan-500/50 text-cyan-400"
                                : "border-zinc-600 text-zinc-400"
                            }>
                              {item.probability}%
                            </Badge>
                            {item.monthly_value > 0 && (
                              <div className="text-xs text-zinc-500 mt-1">${item.monthly_value.toLocaleString()}/mo</div>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-4 text-zinc-500">No active pipeline items</div>
                      )}
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-800">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-400">{closedWonPipeline.length}</div>
                        <div className="text-xs text-zinc-500">Closed Won</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-cyan-400">{activePipeline.length}</div>
                        <div className="text-xs text-zinc-500">Active Deals</div>
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
                      {activities.slice(0, 6).map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-2 rounded hover:bg-zinc-800/50">
                          <div className="text-xs text-zinc-500 w-16 shrink-0 pt-0.5">
                            {formatTime(activity.created_at)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{activity.title}</div>
                            {activity.description && (
                              <div className="text-xs text-zinc-500 truncate">{activity.description}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500 shrink-0">
                            {activity.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Aaron Status (1/3) */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Aaron Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Trust Level */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">Trust Level</span>
                        <span className="text-amber-400 font-medium">TIER 2</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '65%' }} />
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">Execute with approval</div>
                    </div>

                    {/* Today's Stats */}
                    <div className="pt-3 border-t border-zinc-800">
                      <div className="text-sm text-zinc-400 mb-2">Today</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-zinc-800/50 text-center">
                          <div className="text-lg font-bold text-white">
                            {activities.filter(a => {
                              const actDate = new Date(a.created_at).toDateString()
                              return actDate === new Date().toDateString()
                            }).length}
                          </div>
                          <div className="text-xs text-zinc-500">Actions</div>
                        </div>
                        <div className="p-2 rounded bg-zinc-800/50 text-center">
                          <div className="text-lg font-bold text-white">
                            {activities.filter(a => {
                              const actDate = new Date(a.created_at).toDateString()
                              return actDate === new Date().toDateString() && a.type === 'email'
                            }).length}
                          </div>
                          <div className="text-xs text-zinc-500">Emails</div>
                        </div>
                      </div>
                    </div>

                    {/* Decisions */}
                    <div className="pt-3 border-t border-zinc-800">
                      <div className="text-sm text-zinc-400 mb-2">Recent Decisions</div>
                      {decisions.slice(0, 2).map(d => (
                        <div key={d.id} className="text-xs text-zinc-300 py-1 border-b border-zinc-800 last:border-0">
                          {d.title}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== TASKS TAB (FULL LIST) ==================== */}
            <TabsContent value="tasks" className="space-y-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📋 All Tasks
                    <Badge variant="outline" className="ml-2 border-zinc-700 text-zinc-400">
                      {tasks.filter(t => !['done', 'killed'].includes(t.status)).length} active
                    </Badge>
                  </CardTitle>
                  <CardDescription>Full task list from Google Tasks — everything in one place</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Task Sections */}
                  <div className="space-y-6">
                    {/* Urgent */}
                    {tasks.filter(t => t.urgency === 'urgent' && !['done', 'killed'].includes(t.status)).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                          🔴 URGENT ({tasks.filter(t => t.urgency === 'urgent' && !['done', 'killed'].includes(t.status)).length})
                        </h3>
                        <div className="space-y-2">
                          {tasks.filter(t => t.urgency === 'urgent' && !['done', 'killed'].includes(t.status)).map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-red-950/20 border border-red-800/30">
                              <div className="flex-1">
                                <div className="text-sm text-white">{task.title}</div>
                                <div className="text-xs text-zinc-500 mt-1">
                                  {task.assigned_to === 'matthew' ? '🟢' : '🔵'} {task.assigned_to}
                                  {task.google_list_name && ` • ${task.google_list_name}`}
                                </div>
                              </div>
                              {task.due_date && (
                                <Badge variant="outline" className="border-red-500/50 text-red-400 text-xs">
                                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matthew's Tasks */}
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                        🟢 MATTHEW ({allActiveForMatthew.length})
                      </h3>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {allActiveForMatthew.filter(t => t.urgency !== 'urgent').map(task => (
                          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                            <div className="flex-1">
                              <div className="text-sm text-white">{task.title}</div>
                              <div className="text-xs text-zinc-500 mt-1">
                                {task.status}
                                {task.person && ` • ${task.person}`}
                                {task.google_list_name && ` • ${task.google_list_name}`}
                              </div>
                            </div>
                            <Badge variant="outline" className={
                              task.urgency === 'high' ? "border-amber-500/50 text-amber-400" : "border-zinc-700 text-zinc-500"
                            }>
                              {task.urgency}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Aaron's Tasks */}
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                        🔵 AARON ({aaronTasks.length})
                      </h3>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {aaronTasks.map(task => (
                          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                            <div className="flex-1">
                              <div className="text-sm text-white">{task.title}</div>
                              <div className="text-xs text-zinc-500 mt-1">
                                {task.status}
                                {task.type !== 'task' && ` • ${task.type}`}
                              </div>
                            </div>
                            <Badge variant="outline" className="border-zinc-700 text-zinc-500">
                              {task.urgency}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Someday/Later */}
                    {tasks.filter(t => t.status === 'someday').length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-500 mb-3 flex items-center gap-2">
                          ⏸️ SOMEDAY/LATER ({tasks.filter(t => t.status === 'someday').length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {tasks.filter(t => t.status === 'someday').map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
                              <div className="flex-1">
                                <div className="text-sm text-zinc-400">{task.title}</div>
                                <div className="text-xs text-zinc-600 mt-1">
                                  {task.assigned_to === 'matthew' ? '🟢' : '🔵'} {task.assigned_to}
                                  {task.type !== 'task' && ` • ${task.type}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed */}
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                        ✅ COMPLETED ({completedTasks.length})
                      </h3>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {completedTasks.length > 0 ? completedTasks.slice(0, 20).map(task => (
                          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/10 hover:bg-emerald-950/20 transition-colors">
                            <div className="flex-1">
                              <div className="text-sm text-zinc-300">{task.title}</div>
                              <div className="text-xs text-zinc-500 mt-1">
                                {task.assigned_to === 'matthew' ? '🟢' : '🔵'} {task.assigned_to}
                                {' • '}{formatRelativeTime(task.completed_at || task.updated_at)}
                              </div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          </div>
                        )) : (
                          <div className="text-center py-4 text-zinc-500">No completed tasks yet</div>
                        )}
                        {completedTasks.length > 20 && (
                          <div className="text-center pt-2">
                            <span className="text-xs text-zinc-500">Showing 20 of {completedTasks.length} completed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== AARON TAB ==================== */}
            <TabsContent value="aaron" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Needs Matthew */}
                <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-amber-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      Needs Your Input
                      {aaronNeedsMatthew.length > 0 && (
                        <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                          {aaronNeedsMatthew.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Aaron is blocked and needs your help</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aaronNeedsMatthew.length > 0 ? (
                      <div className="space-y-2">
                        {aaronNeedsMatthew.map((task) => (
                          <div key={task.id} className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/30">
                            <div className="font-medium text-white">{task.title}</div>
                            {task.clarity_question && (
                              <div className="text-sm text-amber-300 mt-1">❓ {task.clarity_question}</div>
                            )}
                            {task.description && !task.clarity_question && (
                              <div className="text-sm text-zinc-400 mt-1">{task.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <div className="text-sm text-zinc-400">All clear! Aaron has what he needs.</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* In Progress */}
                <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-cyan-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-cyan-500 animate-pulse" />
                      In Progress
                      {aaronInProgress.length > 0 && (
                        <Badge className="ml-2 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                          {aaronInProgress.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>What Aaron is actively working on</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aaronInProgress.length > 0 ? (
                      <div className="space-y-2">
                        {aaronInProgress.map((task) => (
                          <div key={task.id} className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/30">
                            <div className="font-medium text-white">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-zinc-400 mt-1">{task.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="text-sm text-zinc-400">Nothing actively in progress</div>
                        <div className="text-xs text-zinc-500 mt-1">Check the queue below</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Queue */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-zinc-400" />
                    Queue
                    <Badge className="ml-2 bg-zinc-700 text-zinc-300 border-zinc-600">
                      {aaronQueue.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Tasks assigned to Aaron, not yet started</CardDescription>
                </CardHeader>
                <CardContent>
                  {aaronQueue.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {aaronQueue.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                          <div className="flex-1">
                            <div className="text-sm text-zinc-200">{task.title}</div>
                            {task.urgency && task.urgency !== 'normal' && (
                              <Badge variant="outline" className={
                                task.urgency === 'urgent' ? "border-red-500/50 text-red-400 mt-1" :
                                task.urgency === 'high' ? "border-amber-500/50 text-amber-400 mt-1" :
                                "border-zinc-600 text-zinc-400 mt-1"
                              }>
                                {task.urgency}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-sm text-zinc-400">Queue is empty</div>
                      <div className="text-xs text-zinc-500 mt-1">Assign tasks to Aaron to see them here</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Aaron's Completed */}
              <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-emerald-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Aaron&apos;s Completed
                    <Badge className="ml-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {aaronCompleted.length}
                    </Badge>
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

            {/* ==================== THIS WEEK TAB ==================== */}
            <TabsContent value="week" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cron Schedule */}
                <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-500" />
                      Cron Schedule This Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                      {cronSchedule.map((day) => (
                        <div key={day.day} className="space-y-2">
                          <div className="text-center font-semibold text-zinc-300 pb-2 border-b border-zinc-800">
                            {day.day}
                          </div>
                          <div className="space-y-1">
                            {day.jobs.map((job, idx) => (
                              <div 
                                key={idx} 
                                className="text-xs p-2 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                              >
                                {job}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly Focus */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-amber-500" />
                      Weekly Focus
                    </CardTitle>
                    <CardDescription>
                      {weeklyPriorities ? `Week of ${new Date(weeklyPriorities.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'What matters this week?'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                        {weeklyPriorities.notes && (
                          <div className="pt-3 border-t border-zinc-800">
                            <div className="text-xs text-zinc-500">{weeklyPriorities.notes}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <Target className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                        <div className="text-sm text-zinc-400 mb-2">No priorities set for this week</div>
                        <div className="text-xs text-zinc-500">Sunday 5pm — Aaron will ask you!</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Aaron's Tasks */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-500" />
                    What Aaron&apos;s Working On
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {aaronTasks.length > 0 ? aaronTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded bg-zinc-800 hover:bg-zinc-750 transition-colors">
                        <div className="flex items-center gap-3">
                          {task.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                          {task.status === 'in_progress' && <Clock className="w-5 h-5 text-cyan-500 animate-pulse" />}
                          {task.status === 'pending' && <Clock className="w-5 h-5 text-zinc-500" />}
                          <span className={task.status === 'completed' ? 'text-zinc-500' : 'text-zinc-200'}>
                            {task.title}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                          {task.urgency || task.status}
                        </Badge>
                      </div>
                    )) : (
                      <p className="text-zinc-500 text-center py-4">No active tasks</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== AUTOMATION TAB (LIST VIEW) ==================== */}
            <TabsContent value="automation" className="space-y-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 Automation Status
                  </CardTitle>
                  <CardDescription>
                    {automations.filter(a => a.last_status === 'success').length} healthy, {' '}
                    {automations.filter(a => a.last_status === 'failed').length} failed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-zinc-500 border-b border-zinc-800">
                      <div className="col-span-1">Status</div>
                      <div className="col-span-5">Name</div>
                      <div className="col-span-3">Schedule</div>
                      <div className="col-span-3">Last Run</div>
                    </div>
                    
                    {/* Rows */}
                    {automations.length > 0 ? automations.map((auto) => (
                      <div key={auto.id} className="grid grid-cols-12 gap-4 px-3 py-3 hover:bg-zinc-800/50 rounded items-center">
                        <div className="col-span-1">
                          {auto.last_status === 'success' && (
                            <div className="w-3 h-3 rounded-full bg-emerald-500" title="Success" />
                          )}
                          {auto.last_status === 'failed' && (
                            <div className="w-3 h-3 rounded-full bg-red-500" title="Failed" />
                          )}
                          {auto.last_status === 'pending' && (
                            <div className="w-3 h-3 rounded-full bg-amber-500" title="Pending" />
                          )}
                          {!auto.last_status && (
                            <div className="w-3 h-3 rounded-full bg-zinc-600" title="Never run" />
                          )}
                        </div>
                        <div className="col-span-5 text-sm text-zinc-200">{auto.name}</div>
                        <div className="col-span-3 text-sm text-zinc-500">{auto.schedule}</div>
                        <div className="col-span-3 text-sm text-zinc-500">
                          {auto.last_run ? formatRelativeTime(auto.last_run) : 'Never'}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-zinc-500">No automations configured</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-emerald-950/50 border-emerald-800/50">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl font-bold text-emerald-400 mb-2">
                      {automations.filter(a => a.last_status === 'success').length}
                    </div>
                    <div className="text-sm text-emerald-300/70">Healthy</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-950/50 border-red-800/50">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl font-bold text-red-400 mb-2">
                      {automations.filter(a => a.last_status === 'failed').length}
                    </div>
                    <div className="text-sm text-red-300/70">Failed</div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-950/50 border-amber-800/50">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl font-bold text-amber-400 mb-2">
                      {automations.filter(a => !a.last_status || a.last_status === 'pending').length}
                    </div>
                    <div className="text-sm text-amber-300/70">Pending</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== ACTIVITY FEED TAB ==================== */}
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
                      {activities.length > 0 ? activities.map((activity) => (
                        <div key={activity.id} className="flex gap-4 pb-4 border-b border-zinc-800 last:border-0">
                          <div className="text-sm text-zinc-500 w-24 shrink-0">
                            {formatTime(activity.created_at)}
                            <div className="text-xs">{formatDate(activity.created_at)}</div>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-zinc-200 mb-1">{activity.title}</div>
                            {activity.description && (
                              <div className="text-sm text-zinc-400">{activity.description}</div>
                            )}
                          </div>
                          <Badge variant="outline" className={
                            activity.status === 'completed' 
                              ? "border-emerald-500/30 text-emerald-400"
                              : activity.status === 'failed'
                              ? "border-red-500/30 text-red-400"
                              : "border-zinc-700 text-zinc-500"
                          }>
                            {activity.type}
                          </Badge>
                        </div>
                      )) : (
                        <p className="text-zinc-500 text-center py-8">No activity yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== LOOPS TAB (NEW) ==================== */}
            <TabsContent value="loops" className="space-y-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-500" />
                    Open Loops
                    {loops.length > 0 && (
                      <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {loops.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Stalled items, unanswered messages, and incomplete projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loops.length > 0 ? (
                    <div className="space-y-3">
                      {loops.map((loop) => (
                        <div key={loop.id} className="flex items-start justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={
                                loop.urgency === 'critical' ? "border-red-500/50 text-red-400" :
                                loop.urgency === 'high' ? "border-amber-500/50 text-amber-400" :
                                "border-zinc-600 text-zinc-400"
                              }>
                                {loop.urgency}
                              </Badge>
                              <span className="text-xs text-zinc-500">{loop.type.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="font-medium text-white">{loop.title}</div>
                            {loop.description && (
                              <div className="text-sm text-zinc-400 mt-1">{loop.description}</div>
                            )}
                            <div className="text-xs text-zinc-500 mt-2">
                              Stale since {formatRelativeTime(loop.stale_since)}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button size="sm" variant="outline" className="border-zinc-700">
                              Dismiss
                            </Button>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                              Resolve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <div className="text-lg font-medium text-white">All loops closed!</div>
                      <div className="text-sm text-zinc-400">No stalled items or incomplete projects.</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== SECOND BRAIN TAB (NEW) ==================== */}
            <TabsContent value="brain" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Captures List */}
                <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-violet-500" />
                      Recent Captures
                    </CardTitle>
                    <CardDescription>
                      Ideas, insights, and notes captured from conversations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {captures.length > 0 ? captures.map((capture) => (
                          <div key={capture.id} className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline" className={
                                capture.type === 'insight' ? "border-violet-500/50 text-violet-400" :
                                capture.type === 'idea' ? "border-cyan-500/50 text-cyan-400" :
                                capture.type === 'task' ? "border-amber-500/50 text-amber-400" :
                                "border-zinc-600 text-zinc-400"
                              }>
                                {capture.type}
                              </Badge>
                              <span className="text-xs text-zinc-500">{formatRelativeTime(capture.created_at)}</span>
                            </div>
                            <div className="text-sm text-zinc-200">{capture.content}</div>
                            {capture.source && (
                              <div className="text-xs text-zinc-500 mt-2">Source: {capture.source}</div>
                            )}
                          </div>
                        )) : (
                          <div className="text-center py-8 text-zinc-500">
                            No captures yet. Ideas and insights will appear here.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Decisions Log */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-500" />
                      Decision Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {decisions.length > 0 ? decisions.map((decision) => (
                        <div key={decision.id} className="p-3 rounded-lg bg-zinc-800/50">
                          <div className="font-medium text-sm text-white mb-1">{decision.title}</div>
                          {decision.description && (
                            <div className="text-xs text-zinc-400 mb-2">{decision.description}</div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">{formatDate(decision.made_at)}</span>
                            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                              {decision.status}
                            </Badge>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-4 text-zinc-500">No decisions logged yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Capture */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Input 
                      placeholder="Quick capture — type an idea, insight, or note..."
                      className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-100"
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
                      className="bg-violet-600 hover:bg-violet-700"
                      onClick={handleQuickCapture}
                      disabled={capturing || !captureInput.trim()}
                    >
                      <Lightbulb className="w-4 h-4 mr-2" />
                      {capturing ? 'Saving...' : 'Capture'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        )}
      </main>
    </div>
  )
}
