
import React, { useState, useEffect, useCallback } from 'react';
import type { User, Job } from '../../types';
import { JobStatus } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { useRefresh, useToast } from '../../App';
import LabDashboard from './LabDashboard';
import LabJobsList from './LabJobsList';
import { calculateBusinessHours } from '../../services/timeUtils';


type LabViewMode = 'dashboard' | 'list';

const LabView: React.FC<{ user: User }> = ({ user }) => {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [mode, setMode] = useState<LabViewMode>('dashboard');
    const { refreshKey } = useRefresh();
    const { addToast } = useToast();
    const [overdueJobs, setOverdueJobs] = useState<Job[]>([]);
    const [jobToFocus, setJobToFocus] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        const data = await api.apiGetLabStats();
        setStats(data);
    }, []);

    const fetchOverdueJobs = useCallback(async () => {
        try {
            const potentiallyOverdue = await api.apiGetPotentiallyOverdueJobs();
            const overdueForLab = potentiallyOverdue.filter(job => {
                if (job.status !== JobStatus.SentToLab) {
                    return false;
                }
                const sentEntry = [...job.history].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).find(h => h.status === JobStatus.SentToLab);
                if (!sentEntry) return false;

                return calculateBusinessHours(sentEntry.timestamp) > 48;
            });
            setOverdueJobs(overdueForLab);
        } catch (error) {
            console.error("Failed to fetch overdue jobs for lab", error);
            addToast('Error al verificar trabajos demorados.', 'error');
        }
    }, [addToast]);

    useEffect(() => {
        fetchStats();
        fetchOverdueJobs();
    }, [fetchStats, fetchOverdueJobs, refreshKey]);

    useEffect(() => {
        const channel = supabase
            .channel('lab-jobs-channel-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
                fetchStats();
                fetchOverdueJobs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchStats, fetchOverdueJobs]);

    const handleOverdueJobClick = (job: Job) => {
        setJobToFocus(job.id);
        setMode('list');
    };


    if (mode === 'dashboard') {
        return (
             <LabDashboard 
                stats={stats} 
                overdueJobs={overdueJobs}
                onNavigateToList={() => {
                    setJobToFocus(null);
                    setMode('list');
                }}
                onOverdueJobClick={handleOverdueJobClick}
             />
        );
    }
    
    return <LabJobsList user={user} tabCounts={stats} onBack={() => setMode('dashboard')} onDataUpdate={fetchStats} focusJobId={jobToFocus} overdueJobs={overdueJobs} />;
};

export default LabView;
