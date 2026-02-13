'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  RefreshCw
} from 'lucide-react'

// Mock data - will be replaced with Supabase
const awaitingMatthew = [
  {
    id: 1,
    what: "Approve Ed Doucet call summary email",
    why: "Ready to send to Ed after his first coaching session",
    deadline: "Today",
    quickAction: "View Draft"
  },
  {
    id: 2,
    what: "Review Circle post content for Week 2",
    why: "UR content scheduled for Feb 19, needs your approval",
    deadline: "Feb 15",
    quickAction: "Review Doc"
  },
  {
    id: 3,
    what: "Johan Wedellsborg - confirm call time",
    why: "He responded, waiting for your preferred time",
    deadline: "ASAP",
    quickAction: "See Thread"
  }
]

const thisWeekTasks = [
  { id: 1, task: "Daily email triage (3x/day)", status: "active", type: "recurring" },
  { id: 2, task: "Upload Rapid Rapport recordings", status: "done", type: "automation" },
  { id: 3, task: "NLP Boot Camp Call #5 upload", status: "done", type: "automation" },
  { id: 4, task: "Weekly UR content planning", status: "pending", type: "scheduled" },
  { id: 5, task: "Open Door Coaching backup", status: "done", type: "automation" },
]

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

const automationStatus = [
  { name: "Rapid Rapport Upload", status: "success", time: "11:00am", details: "Posted to Circle AOI" },
  { name: "NLP Boot Camp Upload", status: "success", time: "4:45pm", details: "Posted to Circle AOI" },
  { name: "Open Door Coaching Save", status: "success", time: "1:15pm", details: "Saved to Google Drive" },
  { name: "Email Triage (6am)", status: "success", time: "6:02am", details: "16 high priority, 11 archived" },
  { name: "Email Triage (12pm)", status: "success", time: "12:01pm", details: "6 high priority, 26 archived" },
  { name: "Email Triage (5pm)", status: "success", time: "5:02pm", details: "2 high priority, 8 archived" },
]

const activityFeed = [
  { id: 1, time: "9:31pm", action: "Updated cron job", details: "NLP Boot Camp → only post to ☎️ NLP+ Live Zoom Call space" },
  { id: 2, time: "9:12pm", action: "Downloaded & uploaded", details: "Open Door Coaching (982MB) → Google Drive" },
  { id: 3, time: "7:46pm", action: "Sent email", details: "Ed Doucet coaching session summary from aaron@matthewferry.com" },
  { id: 4, time: "5:02pm", action: "Email triage complete", details: "2 high priority, 8 archived" },
  { id: 5, time: "4:45pm", action: "Uploaded to Circle", details: "NLP+ Language & Rapport - Call #5" },
  { id: 6, time: "4:20pm", action: "Updated cron jobs", details: "Combined 6am jobs, combined Monday Mindset jobs" },
  { id: 7, time: "3:46pm", action: "Created Google Doc", details: "Cron Jobs Full Audit for Matthew's review" },
  { id: 8, time: "3:35pm", action: "Updated pipeline", details: "Ed Doucet → Current Client (closed!)" },
  { id: 9, time: "12:01pm", action: "Email triage complete", details: "6 high priority, 26 archived" },
  { id: 10, time: "11:00am", action: "Uploaded to Circle", details: "Rapid Rapport - 2/12/26" },
]

export default function MissionControl() {
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const handleRefresh = () => {
    setLastRefresh(new Date())
    // Will trigger real data refresh when connected to Supabase
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
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {awaitingMatthew.length}
              </span>
            </Button>
            
            {/* Refresh */}
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="w-5 h-5 text-zinc-400" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="awaiting" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="awaiting" className="data-[state=active]:bg-zinc-800 relative">
              🎯 Awaiting Matthew
              <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
                {awaitingMatthew.length}
              </Badge>
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
          </TabsList>

          {/* Tab 1: Awaiting Matthew */}
          <TabsContent value="awaiting" className="space-y-4">
            <div className="grid gap-4">
              {awaitingMatthew.map((item) => (
                <Card key={item.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                          <h3 className="font-semibold text-lg text-white">{item.what}</h3>
                        </div>
                        <p className="text-zinc-400 ml-8">{item.why}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={
                          item.deadline === "ASAP" 
                            ? "border-red-500/50 text-red-400" 
                            : item.deadline === "Today"
                            ? "border-amber-500/50 text-amber-400"
                            : "border-zinc-600 text-zinc-400"
                        }>
                          {item.deadline}
                        </Badge>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          {item.quickAction}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {awaitingMatthew.length === 0 && (
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
                            {prospect.status === "BOOKED" ? prospect.date : prospect.date}
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
                  {thisWeekTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded bg-zinc-800 hover:bg-zinc-750 transition-colors">
                      <div className="flex items-center gap-3">
                        {task.status === 'done' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        {task.status === 'active' && <Clock className="w-5 h-5 text-cyan-500 animate-pulse" />}
                        {task.status === 'pending' && <Clock className="w-5 h-5 text-zinc-500" />}
                        <span className={task.status === 'done' ? 'text-zinc-500' : 'text-zinc-200'}>
                          {task.task}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                        {task.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Automation Status */}
          <TabsContent value="automation" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {automationStatus.map((auto, idx) => (
                <Card key={idx} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {auto.status === 'success' && (
                          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        {auto.status === 'failed' && (
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                        )}
                        {auto.status === 'running' && (
                          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        <span className="font-medium text-zinc-200">{auto.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{auto.time}</span>
                    </div>
                    <p className="text-sm text-zinc-400">{auto.details}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-emerald-950/50 border-emerald-800/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-emerald-400 mb-2">
                    {automationStatus.filter(a => a.status === 'success').length}
                  </div>
                  <div className="text-sm text-emerald-300/70">Successful Today</div>
                </CardContent>
              </Card>
              <Card className="bg-red-950/50 border-red-800/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-red-400 mb-2">
                    {automationStatus.filter(a => a.status === 'failed').length}
                  </div>
                  <div className="text-sm text-red-300/70">Failed Today</div>
                </CardContent>
              </Card>
              <Card className="bg-amber-950/50 border-amber-800/50">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-amber-400 mb-2">
                    0
                  </div>
                  <div className="text-sm text-amber-300/70">Need Help</div>
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
                    Today
                  </Badge>
                </CardTitle>
                <CardDescription>Every action Aaron takes, logged for full transparency</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {activityFeed.map((activity) => (
                      <div key={activity.id} className="flex gap-4 pb-4 border-b border-zinc-800 last:border-0">
                        <div className="text-sm text-zinc-500 w-20 shrink-0">
                          {activity.time}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-zinc-200 mb-1">{activity.action}</div>
                          <div className="text-sm text-zinc-400">{activity.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
