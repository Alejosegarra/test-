


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme, useRefresh, useToast } from '../../App';
import { JobPriority, JobStatus } from '../../types';
// FIX: Added Job type for RawJobForStats
import type { User, Announcement, StatsResult, Job } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { processJobsToStats } from '../../services/statsProcessor';
import { Card, CardHeader, CardContent, Button, Input, Select, Checkbox } from '../common/UI';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, LineElement, PointElement, type ChartDataset } from 'chart.js';
import { Bar, Doughnut, Line, getElementAtEvent } from 'react-chartjs-2';
import ManageJobs from './ManageJobs';
import ManageAccounts from './ManageAccounts';
import ManageAnnouncements from './ManageAnnouncements';
import { BriefcaseIcon, HistoryIcon, RepeatIcon, BranchIcon, InboxIcon, AlertTriangleIcon, ClockIcon, XIcon } from '../common/Icons';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, LineElement, PointElement);

type AdminView = 'dashboard' | 'jobs' | 'accounts' | 'announcements';
// FIX: RawJobForStats should pick properties from Job type, not User and StatsResult.
type RawJobForStats = Pick<Job, 'branch_name' | 'priority' | 'created_at' | 'status' | 'history'>;
type HealthStats = { pendingReceiptInLab: number; activeAlerts: number; maxLabAgeHours: number; };

const StatCard: React.FC<{ 
    title: string; 
    value: string; 
    // FIX: Specify that the icon element accepts a className prop to fix cloneElement error.
    icon: React.ReactElement<{ className?: string }>;
    colorClass?: string;
    threshold?: { value: number; className: string };
    comparisonValue?: number;
    invertTrend?: boolean; 
}> = ({ title, value, icon, colorClass = 'text-blue-600', threshold, comparisonValue, invertTrend = false }) => {
    
    let percentageChange: number | null = null;
    const numericValue = parseFloat(value.replace(/,/g, '.'));

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
    const isThresholdExceeded = threshold && numericValue > threshold.value;
    const cardClasses = isThresholdExceeded ? threshold.className : '';
    const iconBg = isThresholdExceeded ? '' : 'bg-blue-100 dark:bg-slate-700';
    
    return (
        <Card className={`transition-colors ${cardClasses}`}>
            <CardContent>
                <div className="flex items-center">
                    <div className={`p-3 rounded-full ${iconBg} mr-4 transition-colors`}>
                        {React.cloneElement(icon, { className: `h-6 w-6 ${colorClass}`})}
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
    const { addToast } = useToast();
    
    const [loading, setLoading] = useState(true);
    const [rawJobs, setRawJobs] = useState<RawJobForStats[]>([]);
    const [comparisonJobs, setComparisonJobs] = useState<RawJobForStats[] | undefined>(undefined);
    const [healthStats, setHealthStats] = useState<HealthStats | null>(null);
    const [activeFilters, setActiveFilters] = useState<{ branch?: string, priority?: JobPriority, status?: JobStatus }>({});
    
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [compare, setCompare] = useState(false);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('ALL');

    const branchChartRef = useRef<ChartJS<'bar'>>(null);
    const priorityChartRef = useRef<ChartJS<'doughnut'>>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, healthData, branchesData] = await Promise.all([
                api.apiGetStats({ ...dateRange, compare }),
                api.apiGetSystemHealthStats(),
                api.apiGetAllBranches()
            ]);
            setRawJobs(statsData.currentJobs as RawJobForStats[]);
            setComparisonJobs(statsData.comparisonJobs as RawJobForStats[]);
            setHealthStats(healthData);
            setBranches(branchesData);
        } catch(e) {
            addToast("Error al cargar las métricas", "error");
        } finally {
            setLoading(false);
        }
    }, [dateRange, compare, addToast]);

    useEffect(() => {
        fetchData();
        const channel = supabase
            .channel('public:jobs:stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchData)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData, refreshKey]);

    const filteredJobs = useMemo(() => {
        if (!rawJobs) return [];
        return rawJobs.filter(job => {
            const branchMatch = !activeFilters.branch || job.branch_name === activeFilters.branch;
            const priorityMatch = !activeFilters.priority || job.priority === activeFilters.priority;
            const statusMatch = !activeFilters.status || job.status === activeFilters.status;
            return branchMatch && priorityMatch && statusMatch;
        });
    }, [rawJobs, activeFilters]);

    const stats = useMemo(() => processJobsToStats(filteredJobs), [filteredJobs]);
    const comparisonStats = useMemo(() => processJobsToStats(comparisonJobs || []), [comparisonJobs]);

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

    const clearFilter = (key: keyof typeof activeFilters) => {
        setActiveFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });
    };

    const priorityLabels: Record<JobPriority, string> = {
        [JobPriority.Normal]: 'Normal',
        [JobPriority.Urgente]: 'Urgente',
        [JobPriority.Repeticion]: 'Repetición'
    };
    
    const handleChartClick = (ref: React.RefObject<ChartJS>, event: React.MouseEvent<HTMLCanvasElement>, type: 'branch' | 'priority' | 'status') => {
        const chart = ref.current;
        if (!chart) return;
        const elements = getElementAtEvent(chart, event);
        if (elements.length > 0) {
            const elementIndex = elements[0].index;
            const label = chart.data.labels?.[elementIndex] as string;
            
            if (type === 'branch') {
                setActiveFilters(prev => ({ ...prev, branch: prev.branch === label ? undefined : label }));
            } else if (type === 'priority') {
                const priorityKey = Object.keys(priorityLabels).find(key => priorityLabels[key as JobPriority] === label) as JobPriority;
                setActiveFilters(prev => ({ ...prev, priority: prev.priority === priorityKey ? undefined : priorityKey }));
            }
        }
    };
    
    const chartOptions = useMemo(() => {
        const isDark = theme === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        
        return {
            base: {
                responsive: true,
                maintainAspectRatio: false,
                onHover: (event: any, chartElement: any) => {
                    const canvas = event.native?.target;
                    if (canvas) {
                        canvas.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                },
            },
            get bar() {
                return {
                    ...this.base,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { color: 'transparent' } },
                        y: { ticks: { color: textColor }, grid: { color: gridColor } }
                    }
                }
            },
            get horizontalBar() {
                return {
                    ...this.bar,
                    indexAxis: 'y' as const
                }
            },
            get doughnut() {
                return {
                    ...this.base,
                    plugins: { legend: { labels: { color: textColor } } }
                }
            },
            get line() {
                 return {
                    ...this.base,
                    plugins: { legend: { labels: { color: textColor } } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { color: 'transparent' } },
                        y: { ticks: { color: textColor }, grid: { color: gridColor } }
                    }
                }
            }
        };
    }, [theme]);
    
    // Chart data memos
    const chartDataByBranch = useMemo(() => ({
        labels: Object.keys(stats.jobsByBranch),
        datasets: [{
            label: 'Trabajos por Sucursal',
            data: Object.values(stats.jobsByBranch),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
        }]
    }), [stats.jobsByBranch]);
    
    const chartDataByPriority = useMemo(() => ({
        labels: Object.keys(stats.jobsByPriority).map(p => priorityLabels[p as JobPriority]),
        datasets: [{
            data: Object.values(stats.jobsByPriority),
            backgroundColor: ['rgba(156, 163, 175, 0.7)', 'rgba(234, 179, 8, 0.7)', 'rgba(249, 115, 22, 0.7)']
        }]
    }), [stats.jobsByPriority]);

    const chartDataMonthlyProgress = useMemo(() => {
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const formatLabel = (monthKey: string) => {
            const [year, month] = monthKey.split('-');
            return `${monthNames[parseInt(month, 10) - 1]} ${year.slice(2)}`;
        };
        const allMonthKeys = new Set(stats.monthlyProgress.map(d => d.month));
        if (compare && comparisonStats.monthlyProgress) {
            comparisonStats.monthlyProgress.forEach(d => allMonthKeys.add(d.month));
        }
        const sortedLabels = Array.from(allMonthKeys).sort();
        const labels = sortedLabels.map(formatLabel);
        const currentDataMap = new Map(stats.monthlyProgress.map(d => [d.month, selectedBranch === 'ALL' ? d.total : d.byBranch[selectedBranch] || 0]));
        const currentData = sortedLabels.map(monthKey => currentDataMap.get(monthKey) || null);
        const datasets: ChartDataset<'line', (number | null)[]>[] = [{
            label: `Trabajos Creados (${selectedBranch === 'ALL' ? 'Todos' : selectedBranch})`,
            data: currentData,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }];
        if (compare && comparisonStats.monthlyProgress) {
            const comparisonDataMap = new Map(comparisonStats.monthlyProgress.map(d => [d.month, selectedBranch === 'ALL' ? d.total : d.byBranch[selectedBranch] || 0]));
            const comparisonData = sortedLabels.map(monthKey => comparisonDataMap.get(monthKey) || null);
            datasets.push({
                label: 'Período Anterior',
                data: comparisonData,
                borderColor: 'rgba(239, 68, 68, 0.7)',
                borderDash: [5, 5],
                tension: 0.1
            });
        }
        return { labels, datasets };
    }, [stats.monthlyProgress, comparisonStats.monthlyProgress, selectedBranch, compare]);

    const chartDataCycleTime = useMemo(() => ({
        labels: Object.keys(stats.cycleTimeByBranch),
        datasets: [{
            label: 'Tiempo de Ciclo Promedio (hs)',
            data: Object.values(stats.cycleTimeByBranch).map(t => parseFloat(t.toFixed(1))),
            backgroundColor: 'rgba(22, 163, 74, 0.7)',
        }]
    }), [stats.cycleTimeByBranch]);

    const chartDataTimeInStatus = useMemo(() => {
        const data = stats.averageTimeInStatus;
        const orderedStatuses = [
            JobStatus.SentToLab, JobStatus.ReceivedByLab, JobStatus.Completed, JobStatus.SentToBranch
        ].filter(status => data[status] > 0);
        
        return {
            labels: orderedStatuses,
            datasets: [{
                label: 'Tiempo Promedio en Estado (hs)',
                data: orderedStatuses.map(status => parseFloat(data[status].toFixed(1))),
                backgroundColor: 'rgba(139, 92, 246, 0.7)'
            }]
        };
    }, [stats.averageTimeInStatus]);


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
                     <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-6">Panel de Control Interactivo</h1>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <StatCard title="Pendientes de Recepción (Lab)" value={healthStats?.pendingReceiptInLab?.toString() ?? '0'} icon={<InboxIcon/>} colorClass="text-blue-600" threshold={{value: 20, className: 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'}} />
                        <StatCard title="Alertas Activas (Urg/Rep)" value={healthStats?.activeAlerts?.toString() ?? '0'} icon={<AlertTriangleIcon/>} colorClass="text-yellow-600" threshold={{value: 10, className: 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'}} />
                        <StatCard title="Antigüedad Máxima en Lab" value={`${healthStats?.maxLabAgeHours?.toFixed(1) ?? '0'} hs`} icon={<ClockIcon />} colorClass="text-red-600" threshold={{value: 72, className: 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'}} />
                        <StatCard title="Sucursal Más Activa" value={stats?.mostActiveBranch ?? 'N/A'} icon={<BranchIcon/>} colorClass="text-purple-600" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard title="Trabajos Totales" value={stats?.totalJobs?.toString() ?? '0'} icon={<BriefcaseIcon/>} comparisonValue={comparisonStats?.totalJobs} />
                        <StatCard title="Tiempo de Ciclo Prom." value={`${stats?.averageCycleTime?.toFixed(1) ?? '0'} hs`} icon={<HistoryIcon/>} colorClass="text-green-600" comparisonValue={comparisonStats?.averageCycleTime} invertTrend />
                        <StatCard title="Tasa de Repetición" value={`${stats?.repetitionRate?.toFixed(1) ?? '0'}%`} icon={<RepeatIcon/>} colorClass="text-orange-600" comparisonValue={comparisonStats?.repetitionRate} invertTrend />
                    </div>

                    {Object.values(activeFilters).some(v => v) && (
                        <div className="p-3 mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50 flex items-center gap-4 flex-wrap">
                            <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-200">Filtros Activos:</h4>
                            <div className="flex items-center gap-2 flex-wrap">
                                {Object.entries(activeFilters).map(([key, value]) => value && (
                                    <span key={key} className="inline-flex items-center bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs font-medium px-2.5 py-1 rounded-full">
                                        {`${key.charAt(0).toUpperCase() + key.slice(1)}: ${key === 'priority' ? priorityLabels[value as JobPriority] : value}`}
                                        <button onClick={() => clearFilter(key as keyof typeof activeFilters)} className="ml-1.5 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700">
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                             <Button variant="ghost" size="sm" onClick={() => setActiveFilters({})} className="ml-auto !text-blue-600">Limpiar todo</Button>
                        </div>
                    )}


                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Trabajos por Sucursal</h3></CardHeader>
                            <CardContent className="h-80">
                                <Bar ref={branchChartRef} data={chartDataByBranch} options={chartOptions.bar} onClick={(e) => handleChartClick(branchChartRef, e, 'branch')} />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Tiempo Promedio por Estado (hs)</h3></CardHeader>
                            <CardContent className="h-80">
                                {chartDataTimeInStatus && <Bar data={chartDataTimeInStatus} options={chartOptions.horizontalBar} />}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Distribución de Prioridades</h3></CardHeader>
                            <CardContent className="h-80">
                               <Doughnut ref={priorityChartRef} data={chartDataByPriority} options={chartOptions.doughnut} onClick={(e) => handleChartClick(priorityChartRef, e, 'priority')} />
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Tiempo de Ciclo Promedio por Sucursal (hs)</h3></CardHeader>
                            <CardContent className="h-80">
                                {chartDataCycleTime && <Bar data={chartDataCycleTime} options={chartOptions.bar} />}
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
                            <CardContent className="h-80">
                                <Line data={chartDataMonthlyProgress} options={chartOptions.line} />
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