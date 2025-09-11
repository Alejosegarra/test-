

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme, useRefresh } from '../../App';
// FIX: Imported JobPriority as a value for use in the priority chart, and kept User/Announcement as type-only imports.
import { JobPriority } from '../../types';
import type { User, Announcement } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { Card, CardHeader, CardContent, Button, Input, Select, Checkbox } from '../common/UI';
// FIX: Imported ChartDataset to provide a correct type for chart datasets.
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, LineElement, PointElement, type ChartDataset } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import ManageJobs from './ManageJobs';
import ManageAccounts from './ManageAccounts';
import ManageAnnouncements from './ManageAnnouncements';
import { BriefcaseIcon, HistoryIcon, RepeatIcon, BranchIcon } from '../common/Icons';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, LineElement, PointElement);

type AdminView = 'dashboard' | 'jobs' | 'accounts' | 'announcements';

const StatCard: React.FC<{ 
    title: string; 
    value: string; 
    icon: React.ReactElement;
    comparisonValue?: number;
    invertTrend?: boolean; 
}> = ({ title, value, icon, comparisonValue, invertTrend = false }) => {
    
    let percentageChange: number | null = null;
    const numericValue = parseFloat(value.replace(/,/g, '.')); // Handle decimal comma

    if (comparisonValue !== undefined && comparisonValue !== null) {
        if (comparisonValue > 0) {
            percentageChange = ((numericValue - comparisonValue) / comparisonValue) * 100;
        } else if (numericValue > 0) {
            percentageChange = 100; 
        } else {
            percentageChange = 0;
        }
    }
    
    const isPositive = percentageChange !== null ? (invertTrend ? percentageChange < 0 : percentageChange > 0) : false;
    const isNegative = percentageChange !== null ? (invertTrend ? percentageChange > 0 : percentageChange < 0) : false;
    
    return (
        <Card>
            <CardContent>
                <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100 dark:bg-slate-700 mr-4">
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
                    </div>
                </div>
                 {percentageChange !== null && (
                    <div className="mt-2 text-xs">
                        <span className={`font-semibold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
                            {isPositive ? '▲' : isNegative ? '▼' : ''} {Math.abs(percentageChange).toFixed(1)}% 
                        </span>
                        <span className="text-gray-500 dark:text-slate-400"> vs. período anterior</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


const AdminPanel: React.FC<{user: User, announcements: Announcement[], onAnnouncementsUpdate: () => void}> = ({user, announcements, onAnnouncementsUpdate}) => {
    const [view, setView] = useState<AdminView>('dashboard');
    const { theme } = useTheme();
    const { refreshKey } = useRefresh();
    const [stats, setStats] = useState<any | null>(null);
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [compare, setCompare] = useState(false);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('ALL');


    const fetchStats = useCallback(() => {
        api.apiGetStats({ ...dateRange, compare }).then(setStats);
    }, [dateRange, compare]);

    useEffect(() => {
        api.apiGetAllBranches().then(setBranches);
    }, []);

    useEffect(() => {
        fetchStats();
        const channel = supabase
            .channel('public:jobs:stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchStats)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStats, refreshKey]);

    const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
        setDateRange(prev => ({ ...prev, [field]: value }));
    };

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const setPresetDateRange = (period: 'week' | 'month' | 'quarter') => {
        const end = new Date();
        let start = new Date();
        if (period === 'week') {
            start.setDate(end.getDate() - 6);
        } else if (period === 'month') {
            start = new Date(end.getFullYear(), end.getMonth(), 1);
        } else if (period === 'quarter') {
            start.setMonth(end.getMonth() - 3);
        }
        setDateRange({ startDate: formatDate(start), endDate: formatDate(end) });
    };

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
            },
            line: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor } } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: 'transparent' } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } }
                }
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
        // FIX: Cast the result of Object.values to number[] to resolve TypeScript error.
        const data = Object.values(stats.jobsByPriority) as number[];
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

    const chartDataMonthlyProgress = useMemo(() => {
        if (!stats?.monthlyProgress) return null;

        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const formatLabel = (monthKey: string) => {
            const [year, month] = monthKey.split('-');
            return `${monthNames[parseInt(month, 10) - 1]} ${year.slice(2)}`;
        };

        const allMonthKeys = new Set(stats.monthlyProgress.map(d => d.month));
        if (compare && stats.comparison?.monthlyProgress) {
            stats.comparison.monthlyProgress.forEach(d => allMonthKeys.add(d.month));
        }
        
        const sortedLabels = Array.from(allMonthKeys).sort();
        const labels = sortedLabels.map(formatLabel);
        
        const currentDataMap = new Map(stats.monthlyProgress.map(d => [d.month, selectedBranch === 'ALL' ? d.total : d.byBranch[selectedBranch] || 0]));
        const currentData = sortedLabels.map(monthKey => currentDataMap.get(monthKey) || null); // Use null for missing data points

        // FIX: Explicitly typed 'datasets' to include optional 'borderDash' property, resolving the type error.
        const datasets: ChartDataset<'line', (number | null)[]>[] = [{
            label: `Trabajos Creados (${selectedBranch === 'ALL' ? 'Todos' : selectedBranch})`,
            data: currentData,
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }];

        if (compare && stats.comparison?.monthlyProgress) {
            const comparisonDataMap = new Map(stats.comparison.monthlyProgress.map(d => [d.month, selectedBranch === 'ALL' ? d.total : d.byBranch[selectedBranch] || 0]));
            const comparisonData = sortedLabels.map(monthKey => comparisonDataMap.get(monthKey) || null);
            datasets.push({
                label: 'Período Anterior',
                data: comparisonData,
                fill: false,
                borderColor: 'rgba(239, 68, 68, 0.7)',
                borderDash: [5, 5],
                tension: 0.1
            });
        }
        
        return { labels, datasets };
    }, [stats, selectedBranch, compare]);


    const chartDataCycleTime = useMemo(() => {
        if (!stats?.cycleTimeByBranch) return null;
        const labels = Object.keys(stats.cycleTimeByBranch);
        // FIX: Added a type assertion `(t as number)` because TypeScript could not infer the type of `t` as a number.
        const data = Object.values(stats.cycleTimeByBranch).map(t => parseFloat((t as number).toFixed(1)));
        return {
            labels,
            datasets: [{
                label: 'Tiempo de Ciclo Promedio (hs)',
                data,
                backgroundColor: 'rgba(22, 163, 74, 0.7)',
                borderColor: 'rgba(22, 163, 74, 1)',
                borderWidth: 1,
            }]
        };
    }, [stats]);
    
    const chartDataByStatus = useMemo(() => {
        if (!stats?.jobsByStatus) return null;
        const labels = Object.keys(stats.jobsByStatus);
        // FIX: Cast the result of Object.values to number[] to resolve TypeScript error.
        const data = Object.values(stats.jobsByStatus) as number[];
        const backgroundColors = [
            'rgba(107, 114, 128, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(139, 92, 246, 0.7)',
            'rgba(34, 197, 94, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(16, 185, 129, 0.7)'
        ];
        const borderColors = backgroundColors.map(c => c.replace('0.7', '1'));
        return {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors.slice(0, data.length),
                borderColor: borderColors.slice(0, data.length),
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
                     <div className="p-4 mb-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Desde</label>
                                <Input type="date" value={dateRange.startDate} onChange={(e) => handleDateChange('startDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Hasta</label>
                                <Input type="date" value={dateRange.endDate} onChange={(e) => handleDateChange('endDate', e.target.value)} />
                            </div>
                            <div className="lg:col-span-3 flex items-center justify-end gap-x-4 gap-y-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                     <Button variant="secondary" size="sm" onClick={() => setPresetDateRange('week')}>Últimos 7 días</Button>
                                     <Button variant="secondary" size="sm" onClick={() => setPresetDateRange('month')}>Este Mes</Button>
                                     <Button variant="secondary" size="sm" onClick={() => setPresetDateRange('quarter')}>Últimos 3 Meses</Button>
                                </div>
                                 <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
                                    <Checkbox checked={compare} onChange={e => setCompare(e.target.checked)} disabled={!dateRange.startDate || !dateRange.endDate} />
                                    <span>Comparar</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard title="Trabajos Totales" value={stats?.totalJobs?.toString() ?? '0'} icon={<BriefcaseIcon className="h-6 w-6 text-blue-600"/>} comparisonValue={stats?.comparison?.totalJobs} />
                        <StatCard title="Tiempo de Ciclo Prom." value={`${stats?.averageCycleTime?.toFixed(1) ?? '0'} hs`} icon={<HistoryIcon className="h-6 w-6 text-green-600"/>} comparisonValue={stats?.comparison?.averageCycleTime} invertTrend />
                        <StatCard title="Tasa de Repetición" value={`${stats?.repetitionRate?.toFixed(1) ?? '0'}%`} icon={<RepeatIcon className="h-6 w-6 text-orange-600"/>} comparisonValue={stats?.comparison?.repetitionRate} invertTrend />
                        <StatCard title="Sucursal Más Activa" value={stats?.mostActiveBranch ?? 'N/A'} icon={<BranchIcon className="h-6 w-6 text-purple-600"/>} />
                    </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Trabajos por Sucursal</h3></CardHeader>
                            <CardContent>
                                {chartDataByBranch && <Bar data={chartDataByBranch} options={chartOptions.bar} />}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Tiempo de Ciclo Promedio por Sucursal (hs)</h3></CardHeader>
                            <CardContent>
                                {chartDataCycleTime && <Bar data={chartDataCycleTime} options={chartOptions.bar} />}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Distribución de Prioridades</h3></CardHeader>
                            <CardContent>
                                <div className="h-72">
                                    {chartDataByPriority && <Doughnut data={chartDataByPriority} options={chartOptions.doughnut}/>}
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Distribución de Trabajos por Estado</h3></CardHeader>
                            <CardContent>
                                <div className="h-72">
                                    {chartDataByStatus && <Doughnut data={chartDataByStatus} options={chartOptions.doughnut}/>}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <h3 className="font-bold text-lg dark:text-slate-200">Progreso Mensual de Trabajos</h3>
                                <Select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="w-full sm:w-auto">
                                    <option value="ALL">Todas las sucursales</option>
                                    {branches.map(b => <option key={b.id} value={b.username}>{b.username}</option>)}
                                </Select>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80">
                                    {chartDataMonthlyProgress && <Line data={chartDataMonthlyProgress} options={chartOptions.line} />}
                                </div>
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