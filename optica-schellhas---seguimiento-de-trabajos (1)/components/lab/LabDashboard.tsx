import React, { useMemo } from 'react';
import { useTheme } from '../../App';
import { Card, CardContent, CardHeader, StatCard } from '../common/UI';
import { InboxIcon, BriefcaseIcon, AlertTriangleIcon, ClipboardListIcon, ChevronRightIcon } from '../common/Icons';
import { JobStatus } from '../../types';
import type { LabDashboardStats } from '../../types';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface LabDashboardProps {
    stats: LabDashboardStats | null;
    onNavigateToList: () => void;
}

const LabDashboard: React.FC<LabDashboardProps> = ({ stats, onNavigateToList }) => {
    const { theme } = useTheme();

    const chartOptions = useMemo(() => {
        const isDark = theme === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textColor }, grid: { color: 'transparent' } },
                y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
            }
        };
    }, [theme]);

    const activeJobsChartData = useMemo(() => {
        if (!stats?.activeJobsByBranch) return null;
        const labels = stats.activeJobsByBranch.map(b => b.name);
        const data = stats.activeJobsByBranch.map(b => b.count);
        return {
            labels,
            datasets: [{
                label: 'Trabajos Activos',
                data,
                backgroundColor: 'rgba(96, 165, 250, 0.7)',
                borderColor: 'rgba(96, 165, 250, 1)',
                borderWidth: 1,
            }]
        };
    }, [stats]);
    
    const repetitionsChartData = useMemo(() => {
        if (!stats?.repetitionsByBranch) return null;
        const labels = stats.repetitionsByBranch.map(b => b.name);
        const data = stats.repetitionsByBranch.map(b => b.count);
        return {
            labels,
            datasets: [{
                label: 'Repeticiones',
                data,
                backgroundColor: 'rgba(251, 146, 60, 0.7)',
                borderColor: 'rgba(251, 146, 60, 1)',
                borderWidth: 1,
            }]
        };
    }, [stats]);


    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-6">Panel de Laboratorio</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={<InboxIcon/>} title="Nuevos para Recibir" value={stats?.jobsByStatus?.[JobStatus.SentToLab] || 0} isLoading={!stats} />
                <StatCard icon={<BriefcaseIcon/>} title="Trabajos en Proceso" value={stats?.jobsByStatus?.[JobStatus.ReceivedByLab] || 0} color="text-indigo-500" isLoading={!stats} />
                <StatCard icon={<AlertTriangleIcon/>} title="Prioridades Activas" value={stats?.withAlerts || 0} color="text-yellow-500" isLoading={!stats} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <Card>
                    <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Trabajos Activos por Sucursal</h3></CardHeader>
                    <CardContent className="h-64">
                        {activeJobsChartData ? <Bar data={activeJobsChartData} options={chartOptions} /> : <p className="text-center text-gray-500 dark:text-slate-400">Cargando datos...</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><h3 className="font-bold text-lg dark:text-slate-200">Repeticiones por Sucursal</h3></CardHeader>
                    <CardContent className="h-64">
                        {repetitionsChartData ? <Bar data={repetitionsChartData} options={chartOptions} /> : <p className="text-center text-gray-500 dark:text-slate-400">Cargando datos...</p>}
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <Card className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer" onClick={onNavigateToList}>
                    <CardContent className="flex items-center justify-between">
                        <div className="flex items-center">
                            <ClipboardListIcon className="h-8 w-8 text-blue-600 mr-4"/>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Ver todos los trabajos</h3>
                                <p className="text-gray-600 dark:text-slate-400">Gestionar los trabajos por estado.</p>
                            </div>
                        </div>
                        <ChevronRightIcon className="h-6 w-6 text-gray-400 dark:text-slate-500"/>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LabDashboard;
