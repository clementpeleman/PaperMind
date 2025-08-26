import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { timelineActivityService, WeeklyActivityGroup } from '@/lib/services/timeline-activity-service';
import { TimelineActivity } from '@/lib/database.types';

export interface RealTimelineData {
  weeks: WeeklyActivityGroup[];
  totalActivities: number;
  currentStreak: number;
  longestStreak: number;
  isLoading: boolean;
  error: string | null;
}

const calculateStreaks = (weeks: WeeklyActivityGroup[]): { current: number; longest: number } => {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const today = new Date();
  const currentWeekStart = getWeekStart(today);
  
  // Process weeks chronologically for streak calculation
  const sortedWeeks = [...weeks].sort((a, b) => 
    new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );
  
  for (const week of sortedWeeks) {
    const hasActivity = week.activities.length > 0;
    
    if (hasActivity) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
      
      // Check if this week or last week to maintain current streak
      const weeksDiff = Math.floor(
        (currentWeekStart.getTime() - new Date(week.weekStart).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      if (weeksDiff <= 1) {
        currentStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }
  
  return { current: currentStreak, longest: longestStreak };
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // First day of the week (Sunday)
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// Hook to invalidate timeline queries
export const useTimelineInvalidation = () => {
  const queryClient = useQueryClient();
  
  return (userId: string) => {
    queryClient.invalidateQueries({ 
      queryKey: ['timeline-weekly-activities', userId] 
    });
    queryClient.invalidateQueries({ 
      queryKey: ['timeline-total-activities', userId] 
    });
  };
};

export const useRealTimelineData = (userId: string | null): RealTimelineData => {
  // Query to get weekly activities from the database
  const {
    data: weeklyData,
    isLoading: weeklyLoading,
    error: weeklyError,
  } = useQuery({
    queryKey: ['timeline-weekly-activities', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const result = await timelineActivityService.getWeeklyActivities(userId, {
        limit: 12 // Get last 12 weeks
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.weeks;
    },
    enabled: !!userId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query to get total activity count
  const {
    data: totalData,
    isLoading: totalLoading,
    error: totalError,
  } = useQuery({
    queryKey: ['timeline-total-activities', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const result = await timelineActivityService.getActivities(userId, {
        limit: 1 // We only need the count
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.totalCount;
    },
    enabled: !!userId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const isLoading = weeklyLoading || totalLoading;
    const error = weeklyError || totalError;
    
    if (isLoading || error || !weeklyData) {
      return {
        weeks: [],
        totalActivities: 0,
        currentStreak: 0,
        longestStreak: 0,
        isLoading,
        error: error?.message || null,
      };
    }

    // Calculate streaks
    const { current, longest } = calculateStreaks(weeklyData);

    return {
      weeks: weeklyData,
      totalActivities: totalData || 0,
      currentStreak: current,
      longestStreak: longest,
      isLoading: false,
      error: null,
    };
  }, [weeklyData, totalData, weeklyLoading, totalLoading, weeklyError, totalError]);
};