"use client";

import * as React from "react";
import { 
  Calendar, 
  Clock, 
  FileText, 
  BookOpen, 
  Sparkles, 
  MessageSquare, 
  Tag, 
  Folder,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronRight,
  Activity,
  Flame,
  Trash
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRealTimelineData } from "@/hooks/use-real-timeline-data";
import { TimelineActivity } from "@/lib/database.types";
import { useSupabaseZoteroAuth } from "@/hooks/use-supabase-zotero-auth";

// Timeline component no longer needs props since it gets data from database
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TimelineProps {}

const getActivityIcon = (type: TimelineActivity['activity_type']) => {
  switch (type) {
    case 'paper_added':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'status_changed':
      return <BookOpen className="h-4 w-4 text-green-600" />;
    case 'ai_analysis_completed':
      return <Sparkles className="h-4 w-4 text-purple-600" />;
    case 'note_added':
      return <MessageSquare className="h-4 w-4 text-orange-600" />;
    case 'tag_added':
      return <Tag className="h-4 w-4 text-pink-600" />;
    case 'collection_changed':
      return <Folder className="h-4 w-4 text-indigo-600" />;
    case 'ai_column_generated':
      return <Sparkles className="h-4 w-4 text-cyan-600" />;
    case 'paper_deleted':
      return <Trash className="h-4 w-4 text-red-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getActivityDescription = (activity: TimelineActivity) => {
  const details = activity.details as any; // Type assertion for JSON field
  
  switch (activity.activity_type) {
    case 'paper_added':
      return 'Added to library';
    case 'status_changed':
      return `Status: ${details.oldValue} → ${details.newValue}`;
    case 'ai_analysis_completed':
      return `AI analysis completed${details.analysisType ? ` (${details.analysisType})` : ''}`;
    case 'note_added':
      return 'Notes added';
    case 'tag_added':
      return `Tags: ${details.tags?.join(', ') || 'Added'}`;
    case 'collection_changed':
      return `Collections: ${details.collections?.join(', ') || 'Updated'}`;
    case 'ai_column_generated':
      return `AI column generated: ${details.columnName || 'Unknown'}`;
    case 'paper_deleted':
      return `Removed from library${details.reason ? ` (${details.reason})` : ''}`;
    default:
      return 'Activity recorded';
  }
};

const formatWeekRange = (weekStart: Date, weekEnd: Date): string => {
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
};

const isCurrentWeek = (weekStart: Date, weekEnd: Date): boolean => {
  const now = new Date();
  return now >= weekStart && now <= weekEnd;
};

const ActivityItem = ({ activity }: { activity: TimelineActivity }) => {
  const truncatedTitle = activity.paper_title.length > 45 
    ? activity.paper_title.substring(0, 45) + '...' 
    : activity.paper_title;

  return (
    <div className="flex items-start gap-3 py-2 group">
      <div className="mt-1 p-1.5 rounded-lg bg-gray-50 border border-gray-200 group-hover:border-gray-300 transition-colors">
        {getActivityIcon(activity.activity_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {truncatedTitle}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          {getActivityDescription(activity)}
        </div>
        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(activity.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};

const WeekCard = ({ week, isExpanded, onToggle }: { 
  week: any; 
  isExpanded: boolean; 
  onToggle: () => void;
}) => {
  const totalActivities = week.activities.length;
  const isCurrent = isCurrentWeek(new Date(week.weekStart), new Date(week.weekEnd));
  
  const summaryItems = [
    { count: week.summary.papersAdded, label: 'Added', color: 'text-blue-600 bg-blue-50', icon: FileText },
    { count: week.summary.statusChanges, label: 'Read', color: 'text-green-600 bg-green-50', icon: BookOpen },
    { count: week.summary.analysisCompleted, label: 'Analyzed', color: 'text-purple-600 bg-purple-50', icon: Sparkles },
    { count: week.summary.notesAdded, label: 'Notes', color: 'text-orange-600 bg-orange-50', icon: MessageSquare },
  ].filter(item => item.count > 0);
  
  return (
    <Card className={`relative transition-all duration-200 ${
      isCurrent ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-md' : 'hover:shadow-md'
    }`}>
      {isCurrent && (
        <div className="absolute -top-2 left-4 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
          This Week
        </div>
      )}
      
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isCurrent ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Calendar className={`h-4 w-4 ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {formatWeekRange(new Date(week.weekStart), new Date(week.weekEnd))}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {totalActivities === 0 ? 'No activity' : `${totalActivities} activities`}
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {summaryItems.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {summaryItems.slice(0, 3).map((item, index) => {
                      const IconComponent = item.icon;
                      return (
                        <div key={index} className={`flex items-center gap-1 px-2 py-1 rounded-full ${item.color} text-xs font-medium`}>
                          <IconComponent className="h-3 w-3" />
                          {item.count}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {totalActivities === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity this week</p>
              </div>
            ) : (
              <div className="space-y-1">
                {week.activities.slice(0, 10).map((activity: TimelineActivity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
                {week.activities.length > 10 && (
                  <div className="text-xs text-gray-500 text-center py-2 border-t">
                    +{week.activities.length - 10} more activities
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export function Timeline({}: TimelineProps) {
  const { user, userId } = useSupabaseZoteroAuth();
  
  console.log('📊 Timeline component - User:', {
    supabaseUserId: user?.id,
    zoteroUserId: userId,
    user: user
  });
  
  // We need to get the internal database user ID, not the Supabase user ID
  // The timeline activities are stored with the internal users table ID
  // For now, we'll need to fetch the user from the internal users table
  const [internalUserId, setInternalUserId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const fetchInternalUserId = async () => {
      if (!user?.id) return;
      
      try {
        // Fetch the internal user ID from the users table
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseUserId: user.id,
          }),
        });
        
        if (response.ok) {
          const { user: dbUser } = await response.json();
          console.log('📊 Timeline - Got internal user:', dbUser);
          setInternalUserId(dbUser.id);
        }
      } catch (error) {
        console.error('Failed to fetch internal user ID:', error);
      }
    };
    
    fetchInternalUserId();
  }, [user?.id]);
  
  const timelineData = useRealTimelineData(internalUserId);
  const [expandedWeeks, setExpandedWeeks] = React.useState<Set<string>>(new Set());
  
  // Auto-expand current week
  React.useEffect(() => {
    if (timelineData.weeks.length > 0) {
      const currentWeek = timelineData.weeks.find(week => 
        isCurrentWeek(new Date(week.weekStart), new Date(week.weekEnd))
      );
      if (currentWeek) {
        const weekKey = `${currentWeek.weekStart}-${currentWeek.weekEnd}`;
        setExpandedWeeks(new Set([weekKey]));
      }
    }
  }, [timelineData.weeks]);
  
  const toggleWeek = (weekKey: string) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekKey)) {
      newExpanded.delete(weekKey);
    } else {
      newExpanded.add(weekKey);
    }
    setExpandedWeeks(newExpanded);
  };
  
  if (timelineData.weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Progress Timeline
          </CardTitle>
          <CardDescription>
            Track your research activity and progress over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No timeline data yet</p>
            <p className="text-sm text-gray-400">
              Add papers to your library to start tracking your progress
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timelineData.totalActivities}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Weeks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timelineData.weeks.filter(w => w.activities.length > 0).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className={`h-4 w-4 ${timelineData.currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timelineData.currentStreak}</div>
            <p className="text-xs text-muted-foreground">weeks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Streak</CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timelineData.longestStreak}</div>
            <p className="text-xs text-muted-foreground">weeks</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Timeline Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weekly Progress Timeline
              </CardTitle>
              <CardDescription>
                Track your research activity and progress over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedWeeks(new Set())}
              >
                Collapse All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allKeys = timelineData.weeks.map(w => 
                    `${w.weekStart}-${w.weekEnd}`
                  );
                  setExpandedWeeks(new Set(allKeys));
                }}
              >
                Expand All
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Loading and Error States */}
      {timelineData.isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-gray-500">
              <Activity className="h-4 w-4 animate-spin" />
              <span>Loading timeline...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {timelineData.error && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 mb-2">Failed to load timeline</div>
              <div className="text-sm text-gray-500">{timelineData.error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {!timelineData.isLoading && !timelineData.error && (
        <div className="space-y-4">
          {timelineData.weeks.map((week, index) => {
            const weekKey = `${week.weekStart}-${week.weekEnd}`;
            const isExpanded = expandedWeeks.has(weekKey);
            
            return (
              <div key={weekKey} className="relative">
                {index < timelineData.weeks.length - 1 && (
                  <div className="absolute left-6 top-16 w-0.5 h-4 bg-gray-200 z-0" />
                )}
                <WeekCard
                  week={week}
                  isExpanded={isExpanded}
                  onToggle={() => toggleWeek(weekKey)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}