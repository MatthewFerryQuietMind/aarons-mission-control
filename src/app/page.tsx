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
  Loader2
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

// Static data for cron schedule and pipeline (will be dynamic later)
const cronSchedule = [
  { day: "Mon", jobs: ["6am Morning Sync", "10:30am Monday Mindset"] },
  { day: "Tue", jobs: ["Email Triage (3x)", "11am Rapid Rapport"] },
  { day: "Wed", jobs: ["Email Triage (3x)", "11am Rapid Rapport", "1:30pm MJM Mastermind", "5pm Lead Conversion"] },
  { day: "Thu", jobs: ["Email Triage (3x)", "11am Rapid Rapport", "1pm Open Door", "4:30pm NLP Boot Camp"] },
  { day: "Fri", jobs: ["Email Triage (3x)", "3pm UR Post"] },
  { day: "Sat", jobs: ["Minimal"] },
  { day: "Sun", jobs: ["5pm Weekly Content Planning", "6pm UR Integration Post"] },
]

const pipeline = {
  mrr: 21666,
  mrrGoal: 40000,
  clients: 6,
  clientGoal: 10,
  hotProspects: [
    { name: "Nikolaj Albinus", status: "BOOKED", date: "Sun 9:30am" },
    { name: "Jeff Beggins", status: "BOOKED", date: "Mon" },
    { name: "Johan Wedellsborg", status: "Waiting", date: "Sent times" },
  ]
}

export default function MissionControl() {
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [loading, setLoading] = useState(true)
  
  // Data from Supabase
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [automations, setAutomations] = useState<Automation[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])

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
      
      if (tasksData) setTasks(tasksData)
      if (activitiesData) setActivities(activitiesData)
      if (automationsData) setAutomations(automationsData)
      if (ideasData) setIdeas(ideasData)
      
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

    const automationsSubscription = supabase
      .channel('automations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, fetchData)
      .subscribe()

    return () => {
      tasksSubscription.unsubscribe()
      activitiesSubscription.unsubscribe()
      automationsSubscription.unsubscribe()
    }
  }, [])

  // Filter tasks awaiting Matthew
  const awaitingMatthew = tasks.filter(t => t.assigned_to === 'matthew' && t.status === 'pending')
  const aaronTasks = tasks.filter(t => t.assigned_to === 'aaron')

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

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
              <h1 className="text-xl font-bold text-white">Aaron&apos;s Mission Control</h1>
              <p className="text-xs text-zinc-500">Last updated: {lastRefresh.toLocaleTimeString()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder="Search everything... (⌘K)" 
                className="w-64 pl-10 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-zinc-400" />
              {awaitingMatthew.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
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
          <Tabs defaultValue="awaiting" className="space-y-6">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="awaiting" className="data-[state=active]:bg-zinc-800 relative">
                🎯 Awaiting Matthew
                {awaitingMatthew.length > 0 && (
                  <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
                    {awaitingMatthew.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="week" className="data-[state=active]:bg-zinc-800">
                📊 This Week
              </TabsTrigger>
              <TabsTrigger value="automation" className="data-[state=active]:bg-zinc-800">
                🤖 Automation Status
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-zinc-800">
                📜 Activity Feed
              </TabsTrigger>
              <TabsTrigger value="ideas" className="data-[state=active]:bg-zinc-800">
                💡 Ideas Backlog
                {ideas.length > 0 && (
                  <Badge className="ml-2 bg-violet-500/20 text-violet-400 border-violet-500/30">
                    {ideas.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Awaiting Matthew */}
            <TabsContent value="awaiting" className="space-y-4">
              <div className="grid gap-4">
                {awaitingMatthew.length > 0 ? awaitingMatthew.map((item) => (
                  <Card key={item.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <h3 className="font-semibold text-lg text-white">{item.title}</h3>
                          </div>
                          <p className="text-zinc-400 ml-8">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={
                            item.priority === "urgent" 
                              ? "border-red-500/50 text-red-400" 
                              : item.priority === "high"
                              ? "border-amber-500/50 text-amber-400"
                              : "border-zinc-600 text-zinc-400"
                          }>
                            {item.due_date ? formatDate(item.due_date) : item.priority}
                          </Badge>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                            View
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">All clear!</h3>
                      <p className="text-zinc-400">Nothing needs your attention right now.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: This Week */}
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

                {/* Pipeline Snapshot */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      Pipeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* MRR Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">MRR</span>
                        <span className="text-white font-semibold">${pipeline.mrr.toLocaleString()} / ${pipeline.mrrGoal.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
                          style={{ width: `${(pipeline.mrr / pipeline.mrrGoal) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{Math.round((pipeline.mrr / pipeline.mrrGoal) * 100)}% of goal</p>
                    </div>

                    {/* Clients */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-zinc-400">Coaching Clients</span>
                        <span className="text-white font-semibold">{pipeline.clients} / {pipeline.clientGoal}</span>
                      </div>
                      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${(pipeline.clients / pipeline.clientGoal) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Hot Prospects */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Hot Prospects
                      </h4>
                      <div className="space-y-2">
                        {pipeline.hotProspects.map((prospect, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-800">
                            <span className="text-sm text-zinc-300">{prospect.name}</span>
                            <Badge variant="outline" className={
                              prospect.status === "BOOKED" 
                                ? "border-emerald-500/50 text-emerald-400"
                                : "border-amber-500/50 text-amber-400"
                            }>
                              {prospect.date}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Task List */}
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

            {/* Tab 3: Automation Status */}
            <TabsContent value="automation" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {automations.length > 0 ? automations.map((auto) => (
                  <Card key={auto.id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {auto.last_status === 'success' && (
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          )}
                          {auto.last_status === 'failed' && (
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                          )}
                          {auto.last_status === 'pending' && (
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                          )}
                          <span className="font-medium text-zinc-200">{auto.name}</span>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {auto.last_run ? formatTime(auto.last_run) : 'Never'}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400">{auto.description || auto.schedule}</p>
                    </CardContent>
                  </Card>
                )) : (
                  <Card className="col-span-full bg-zinc-900 border-zinc-800">
                    <CardContent className="p-8 text-center">
                      <p className="text-zinc-500">No automations configured yet</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-emerald-950/50 border-emerald-800/50">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl font-bold text-emerald-400 mb-2">
                      {automations.filter(a => a.last_status === 'success').length}
                    </div>
                    <div className="text-sm text-emerald-300/70">Successful</div>
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
                      {automations.filter(a => a.last_status === 'pending').length}
                    </div>
                    <div className="text-sm text-amber-300/70">Pending</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab 4: Activity Feed */}
            <TabsContent value="activity">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    📜 Activity Feed
                    <Badge variant="outline" className="ml-2 border-zinc-700 text-zinc-500">
                      {activities.length} entries
                    </Badge>
                  </CardTitle>
                  <CardDescription>Every action Aaron takes, logged for full transparency</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                      {activities.length > 0 ? activities.map((activity) => (
                        <div key={activity.id} className="flex gap-4 pb-4 border-b border-zinc-800 last:border-0">
                          <div className="text-sm text-zinc-500 w-24 shrink-0">
                            {formatTime(activity.created_at)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-zinc-200 mb-1">{activity.title}</div>
                            <div className="text-sm text-zinc-400">{activity.description}</div>
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
                        <p className="text-zinc-500 text-center py-8">No activity yet. Aaron will start logging actions here.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 5: Ideas Backlog */}
            <TabsContent value="ideas" className="space-y-6">
              {/* Priority Groups */}
              {['high', 'medium', 'low'].map((priority) => {
                const priorityIdeas = ideas.filter(i => i.priority === priority)
                if (priorityIdeas.length === 0) return null
                return (
                  <Card key={priority} className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {priority === 'high' && '🔥'}
                        {priority === 'medium' && '📌'}
                        {priority === 'low' && '💭'}
                        {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                        <Badge variant="outline" className="ml-2 border-zinc-700 text-zinc-500">
                          {priorityIdeas.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {priorityIdeas.map((idea) => (
                          <div key={idea.id} className="flex items-start justify-between p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                            <div className="flex-1">
                              <div className="font-medium text-zinc-200 mb-1">{idea.title}</div>
                              <div className="text-sm text-zinc-400">{idea.description}</div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge variant="outline" className={
                                idea.status === 'in_progress'
                                  ? "border-cyan-500/30 text-cyan-400"
                                  : idea.status === 'planned'
                                  ? "border-amber-500/30 text-amber-400"
                                  : "border-zinc-700 text-zinc-500"
                              }>
                                {idea.status}
                              </Badge>
                              {idea.category && (
                                <Badge variant="outline" className="border-violet-500/30 text-violet-400">
                                  {idea.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              
              {ideas.length === 0 && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-12 text-center">
                    <p className="text-zinc-500">No ideas in the backlog yet.</p>
                  </CardContent>
                </Card>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">{ideas.length}</div>
                    <div className="text-xs text-zinc-500">Total Ideas</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-950/30 border-red-800/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-400 mb-1">{ideas.filter(i => i.priority === 'high').length}</div>
                    <div className="text-xs text-red-300/70">High Priority</div>
                  </CardContent>
                </Card>
                <Card className="bg-cyan-950/30 border-cyan-800/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-cyan-400 mb-1">{ideas.filter(i => i.status === 'in_progress').length}</div>
                    <div className="text-xs text-cyan-300/70">In Progress</div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-950/30 border-amber-800/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-400 mb-1">{ideas.filter(i => i.status === 'planned').length}</div>
                    <div className="text-xs text-amber-300/70">Planned</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
