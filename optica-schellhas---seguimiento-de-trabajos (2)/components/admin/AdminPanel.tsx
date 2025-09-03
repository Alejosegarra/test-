
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme, useRefresh } from '../../App';
// FIX: Imported JobPriority as a value for use in the priority chart, and kept User/Announcement as type-only imports.
import { JobPriority } from '../../types';
import type { User, Announcement } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { Card, CardHeader, CardContent } from '../common/UI';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ManageJobs from './ManageJobs';
import ManageAccounts from './ManageAccounts';
import ManageAnnouncements from './ManageAnnouncements';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController);

type AdminView = 'dashboard' | 'jobs' | 'accounts' | 'announcements';

const AdminPanel: React.FC<{user: User, announcements: Announcement[], onAnnouncementsUpdate: () => void}> = ({user, announcements, onAnnouncementsUpdate}) => {
    const [view, setView] = useState<AdminView>('dashboard');
    const { theme } = useTheme();
    const { refreshKey } = useRefresh();
    const [stats, setStats] = useState<{
        totalJobs: number;
        jobsByBranch: Record<string, number>;
        jobsByPriority: Record<JobPriority, number>;
    } | null>(null);

    const fetchStats = useCallback(() => api.apiGetStats().then(setStats), []);

    useEffect(() => {
        fetchStats();
        const channel = supabase
            .channel('public:jobs:stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchStats)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStats, refreshKey]);

    const chartOptions = useMemo(() => {
        const isDark = theme === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        
        return {
            bar: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: 'transparent' } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } }
                }
            },
            doughnut: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor } } }
            }
        };
    }, [theme]);

    const chartDataByBranch = useMemo(() => {
        if (!stats) return null;
        const labels = Object.keys(stats.jobsByBranch);
        const data = Object.values(stats.jobsByBranch);
        return {
            labels,
            datasets: [{
                label: 'Trabajos por Sucursal',
                data,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
            }]
        };
    }, [stats]);
    
    const chartDataByPriority = useMemo(() => {
        if (!stats) return null;
        const priorityLabels = {
            [JobPriority.Normal]: 'Normal',
            [JobPriority.Urgente]: 'Urgente',
            [JobPriority.Repeticion]: 'Repetición'
        };
        const labels = Object.keys(stats.jobsByPriority).map(p => priorityLabels[p as JobPriority]).filter(Boolean);
        const data = Object.values(stats.jobsByPriority);
        return {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    'rgba(156, 163, 175, 0.7)',
                    'rgba(234, 179, 8, 0.7)',
                    'rgba(249, 115, 22, 0.7)'
                ],
                borderColor: [
                    'rgba(156, 163, 175, 1)',
                    'rgba(234, 179, 8, 1)',
                    'rgba(249, 115, 22, 1)'
                ],
                borderWidth: 1,
            }]
        };
    }, [stats]);


    return (
        <div>
            <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
                {(['dashboard', 'jobs', 'accounts', 'announcements'] as AdminView[]).map(v => (
                    <button key={v} onClick={() => setView(v)} className={`capitalize py-2 px-4 text-sm md:text-base font-medium ${view === v ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 dark:text-slate-400'}`}>
                        {v === 'dashboard' ? 'Métricas' : v === 'jobs' ? 'Trabajos' : v === 'accounts' ? 'Cuentas' : 'Anuncios'}
                    </button>
                ))}
            </div>
            
            {view === 'dashboard' && (
                <div>
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-6">Métricas del Sistema</h1>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Trabajos por Sucursal</h3></CardHeader>
                            <CardContent>
                                {chartDataByBranch && <Bar data={chartDataByBranch} options={chartOptions.bar} />}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Distribución de Prioridades</h3></CardHeader>
                            <CardContent className="flex justify-center items-center h-full max-h-[300px] lg:max-h-full">
                                {chartDataByPriority && <Doughnut data={chartDataByPriority} options={chartOptions.doughnut}/>}
                            </CardContent>
                        </Card>
                     </div>
                </div>
            )}
            
            {view === 'jobs' && <ManageJobs user={user} />}
            {view === 'accounts' && <ManageAccounts />}
            {view === 'announcements' && <ManageAnnouncements announcements={announcements} onUpdate={onAnnouncementsUpdate}/>}
        </div>
    );
};

export default AdminPanel;