import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import LabDashboard from './LabDashboard';
import LabJobsList from './LabJobsList';


type LabViewMode = 'dashboard' | 'list';

const LabView: React.FC<{ user: User }> = ({ user }) => {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [mode, setMode] = useState<LabViewMode>('dashboard');

    const fetchStats = useCallback(async () => {
        const data = await api.apiGetLabStats();
        setStats(data);
    }, []);

    useEffect(() => {
        fetchStats();
        const channel = supabase
            .channel('lab-jobs-channel-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchStats)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchStats]);


    if (mode === 'dashboard') {
        return (
             <LabDashboard stats={stats} onNavigateToList={() => setMode('list')} />
        );
    }
    
    return <LabJobsList user={user} tabCounts={stats} onBack={() => setMode('dashboard')} />;
};

export default LabView;
