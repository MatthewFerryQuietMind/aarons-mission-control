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
  description: string
  status: string
  priority: string
  assigned_to: string
  due_date: string | null
  created_at: string
  metadata?: {
    link?: string
    action_type?: string
    post_content?: string
  }
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
  
  const awaitingMatthew = tasks.filter(t => {
    if (t.assigned_to !== 'matthew' || t.status !== 'pending') return false
    // Always show urgent items
    if (t.priority === 'urgent') return true
    // Show if due within 2 days
    if (t.due_date) {
      const dueDate = new Date(t.due_date)
      return dueDate <= twoDaysFromNow
    }
    // If no due date and not urgent, don't show in "Needs You Now"
    return false
  })
  
  // All pending tasks for Matthew (for other views)
  const allPendingForMatthew = tasks.filter(t => t.assigned_to === 'matthew' && t.status === 'pending')
  const aaronTasks = tasks.filter(t => t.assigned_to === 'aaron')

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
              <TabsTrigger value="week" className="data-[state=active]:bg-zinc-800">
                📊 This Week
              </TabsTrigger>
              <TabsTrigger value="automation" className="data-[state=active]:bg-zinc-800">
                🤖 Automation
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-zinc-800">
                📜 Activity
              </TabsTrigger>
              <TabsTrigger value="loops" className="data-[state=active]:bg-zinc-800 relative">
                🔁 Loops
                {loops.length > 0 && (
                  <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {loops.length}
                  </Badge>
                )}
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
                              item.priority === "urgent" 
                                ? "border-red-500/50 text-red-400" 
                                : "border-amber-500/50 text-amber-400"
                            }>
                              {item.priority}
                            </Badge>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                              Review <ArrowRight className="w-4 h-4 ml-1" />
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
                          {task.priority}
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

              {/* Quick Capture (placeholder) */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Input 
                      placeholder="Quick capture — type an idea, insight, or note..."
                      className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-100"
                    />
                    <Button className="bg-violet-600 hover:bg-violet-700">
                      <Lightbulb className="w-4 h-4 mr-2" />
                      Capture
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
