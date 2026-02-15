'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from 'next/link'
import { 
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RefreshCw,
  Loader2
} from 'lucide-react'

// Full cron schedule data (will be dynamic from Supabase later)
const fullCronSchedule = [
  { time: "6:00 AM", name: "Morning Email Triage", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], status: "success" },
  { time: "10:30 AM", name: "Monday Mindset Circle Post", days: ["Mon"], status: "success" },
  { time: "11:00 AM", name: "Rapid Rapport Live Reminder", days: ["Tue", "Wed", "Thu"], status: "success" },
  { time: "12:00 PM", name: "Midday Email Triage", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], status: "success" },
  { time: "1:00 PM", name: "Open Door Session", days: ["Thu"], status: "success" },
  { time: "1:30 PM", name: "MJM Live Session", days: ["Wed"], status: "success" },
  { time: "3:00 PM", name: "UR Content Post", days: ["Fri"], status: "success" },
  { time: "4:30 PM", name: "NLP Session", days: ["Thu"], status: "success" },
  { time: "5:00 PM", name: "Evening Email Triage", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], status: "success" },
  { time: "5:00 PM", name: "Lead Conversion Live", days: ["Wed"], status: "success" },
  { time: "5:00 PM", name: "Weekly Content Prep", days: ["Sun"], status: "pending" },
  { time: "6:00 PM", name: "UR Integration Session", days: ["Sun"], status: "success" },
]

const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function CronPage() {
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const refresh = () => {
    setLoading(true)
    setTimeout(() => {
      setLastRefresh(new Date())
      setLoading(false)
    }, 500)
  }

  // Group jobs by day
  const jobsByDay = dayOrder.map(day => ({
    day,
    jobs: fullCronSchedule.filter(job => job.days.includes(day)).sort((a, b) => {
      const timeA = new Date(`1970-01-01 ${a.time}`).getTime()
      const timeB = new Date(`1970-01-01 ${b.time}`).getTime()
      return timeA - timeB
    })
  }))

  // Stats
  const totalJobs = fullCronSchedule.length
  const successJobs = fullCronSchedule.filter(j => j.status === 'success').length
  const failedJobs = fullCronSchedule.filter(j => j.status === 'failed').length
  const pendingJobs = fullCronSchedule.filter(j => j.status === 'pending').length

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Cron Jobs</h1>
              <p className="text-xs text-zinc-500">All scheduled automations • Updated {formatTime(lastRefresh)}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-white">{totalJobs}</div>
              <div className="text-xs text-zinc-500">Total Jobs</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-950/50 border-emerald-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{successJobs}</div>
              <div className="text-xs text-emerald-300/70">Healthy</div>
            </CardContent>
          </Card>
          <Card className="bg-red-950/50 border-red-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{failedJobs}</div>
              <div className="text-xs text-red-300/70">Failed</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-950/50 border-amber-800/50">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{pendingJobs}</div>
              <div className="text-xs text-amber-300/70">Pending</div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Schedule Grid */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-500" />
              Weekly Schedule
            </CardTitle>
            <CardDescription>All cron jobs organized by day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-3">
              {jobsByDay.map(({ day, jobs }) => (
                <div key={day} className="space-y-2">
                  <div className={`text-center font-semibold pb-2 border-b border-zinc-800 ${
                    day === new Date().toLocaleDateString('en-US', { weekday: 'short' }) 
                      ? 'text-cyan-400' 
                      : 'text-zinc-300'
                  }`}>
                    {day}
                    {day === new Date().toLocaleDateString('en-US', { weekday: 'short' }) && (
                      <span className="ml-1 text-xs text-cyan-500">•</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {jobs.length > 0 ? jobs.map((job, idx) => (
                      <div 
                        key={idx} 
                        className={`text-xs p-2 rounded transition-colors ${
                          job.status === 'success' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' :
                          job.status === 'failed' ? 'bg-red-950/50 text-red-300 border border-red-800/30' :
                          'bg-amber-950/30 text-amber-300 border border-amber-800/30'
                        }`}
                      >
                        <div className="font-medium">{job.time}</div>
                        <div className="text-zinc-500 text-[10px] mt-0.5 leading-tight">{job.name}</div>
                      </div>
                    )) : (
                      <div className="text-xs text-zinc-600 text-center py-2">
                        Minimal
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Full Job List */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-500" />
              All Jobs
            </CardTitle>
            <CardDescription>Complete list with status and schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-900">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Time</div>
                  <div className="col-span-5">Days</div>
                </div>
                
                {/* Rows */}
                {fullCronSchedule.map((job, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 px-3 py-3 hover:bg-zinc-800/50 rounded items-center">
                    <div className="col-span-1">
                      {job.status === 'success' && (
                        <div className="w-3 h-3 rounded-full bg-emerald-500" title="Success" />
                      )}
                      {job.status === 'failed' && (
                        <div className="w-3 h-3 rounded-full bg-red-500" title="Failed" />
                      )}
                      {job.status === 'pending' && (
                        <div className="w-3 h-3 rounded-full bg-amber-500" title="Pending" />
                      )}
                    </div>
                    <div className="col-span-4 text-sm text-zinc-200">{job.name}</div>
                    <div className="col-span-2 text-sm text-zinc-500">{job.time}</div>
                    <div className="col-span-5 flex gap-1 flex-wrap">
                      {job.days.map(day => (
                        <Badge key={day} variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                          {day}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
