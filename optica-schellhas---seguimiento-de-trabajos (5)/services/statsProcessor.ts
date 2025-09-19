
import { JobStatus, JobPriority } from '../types';
import type { Job, StatsResult } from '../types';

/**
 * Processes a list of raw job data into a structured statistics object.
 * @param allJobs - An array of job objects with minimal properties needed for stats calculation.
 * @returns A StatsResult object.
 */
export const processJobsToStats = (allJobs: Pick<Job, 'branch_name' | 'priority' | 'created_at' | 'status' | 'history'>[] | null): StatsResult => {
    const emptyStats: StatsResult = {
        totalJobs: 0,
        jobsByBranch: {},
        jobsByPriority: {
            [JobPriority.Normal]: 0,
            [JobPriority.Urgente]: 0,
            [JobPriority.Repeticion]: 0,
        },
        monthlyProgress: [],
        averageCycleTime: 0,
        repetitionRate: 0,
        mostActiveBranch: 'N/A',
        cycleTimeByBranch: {},
        jobsByStatus: {},
        averageTimeInStatus: {},
    };

    if (!allJobs || allJobs.length === 0) {
        return emptyStats;
    }

    const jobsByBranch = allJobs.reduce((acc, job) => {
        if(job.branch_name) acc[job.branch_name] = (acc[job.branch_name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const jobsByPriority = allJobs.reduce((acc, job) => {
        acc[job.priority] = (acc[job.priority] || 0) + 1;
        return acc;
    }, { [JobPriority.Normal]: 0, [JobPriority.Urgente]: 0, [JobPriority.Repeticion]: 0 } as Record<JobPriority, number>);

    const monthlyData: Record<string, { total: number; byBranch: Record<string, number> }> = {};
    
    allJobs.forEach(job => {
        const date = new Date(job.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, byBranch: {} };
        }
        
        monthlyData[monthKey].total++;
        if (job.branch_name) {
             monthlyData[monthKey].byBranch[job.branch_name] = (monthlyData[monthKey].byBranch[job.branch_name] || 0) + 1;
        }
    });
    
    const monthlyProgress = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));
        
    const mostActiveBranch = Object.entries(jobsByBranch).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0])[0] || 'N/A';
    
    const repetitionJobsCount = allJobs.filter(j => j.priority === JobPriority.Repeticion).length;
    const repetitionRate = allJobs.length > 0 ? (repetitionJobsCount / allJobs.length) * 100 : 0;

    const jobsByStatus = allJobs.reduce((acc, job) => {
        if (job.status) acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    let totalCycleTime = 0;
    let completedJobsCount = 0;
    const cycleTimeDataByBranch: Record<string, { totalHours: number; count: number }> = {};
    const statusDurations: Record<string, { totalHours: number; count: number }> = {};

    allJobs.forEach(job => {
        const sortedHistory = [...(job.history || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Cycle time calculation
        const sentToLabEntry = sortedHistory.find(h => h.status === JobStatus.SentToLab);
        const completedEntry = sortedHistory.find(h => h.status === JobStatus.Completed);
        if (sentToLabEntry && completedEntry) {
            const startTime = new Date(sentToLabEntry.timestamp).getTime();
            const endTime = new Date(completedEntry.timestamp).getTime();
            if (endTime > startTime) {
                const cycleHours = (endTime - startTime) / (1000 * 60 * 60);
                totalCycleTime += cycleHours;
                completedJobsCount++;

                if (job.branch_name) {
                    if (!cycleTimeDataByBranch[job.branch_name]) {
                        cycleTimeDataByBranch[job.branch_name] = { totalHours: 0, count: 0 };
                    }
                    cycleTimeDataByBranch[job.branch_name].totalHours += cycleHours;
                    cycleTimeDataByBranch[job.branch_name].count++;
                }
            }
        }

        // Time in status calculation
        for (let i = 0; i < sortedHistory.length - 1; i++) {
            const currentEntry = sortedHistory[i];
            const nextEntry = sortedHistory[i+1];
            if (Object.values(JobStatus).includes(currentEntry.status as JobStatus)) {
                const durationHours = (new Date(nextEntry.timestamp).getTime() - new Date(currentEntry.timestamp).getTime()) / (1000 * 60 * 60);
                if (!statusDurations[currentEntry.status]) {
                    statusDurations[currentEntry.status] = { totalHours: 0, count: 0 };
                }
                statusDurations[currentEntry.status].totalHours += durationHours;
                statusDurations[currentEntry.status].count++;
            }
        }
    });

    const averageCycleTime = completedJobsCount > 0 ? totalCycleTime / completedJobsCount : 0;
    
    const cycleTimeByBranch = Object.entries(cycleTimeDataByBranch).reduce((acc, [branch, data]) => {
        acc[branch] = data.count > 0 ? data.totalHours / data.count : 0;
        return acc;
    }, {} as Record<string, number>);

    const averageTimeInStatus = Object.entries(statusDurations).reduce((acc, [status, data]) => {
        acc[status] = data.count > 0 ? data.totalHours / data.count : 0;
        return acc;
    }, {} as Record<string, number>);

    return {
        totalJobs: allJobs.length,
        jobsByBranch,
        jobsByPriority,
        monthlyProgress,
        averageCycleTime,
        repetitionRate,
        mostActiveBranch,
        cycleTimeByBranch,
        jobsByStatus,
        averageTimeInStatus,
    };
};