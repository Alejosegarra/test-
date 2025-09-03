import React from 'react';
import { Card, CardContent } from '../common/UI';
import { InboxIcon, BriefcaseIcon, AlertTriangleIcon, ClipboardListIcon, ChevronRightIcon } from '../common/Icons';
import { JobStatus } from '../../types';

const StatCard: React.FC<{icon: React.ReactElement<{ className?: string }>, title: string, value: number, color?: string}> = ({icon, title, value, color='text-blue-600'}) => (
    <Card>
        <CardContent className="flex items-center">
            <div className={`mr-4 text-3xl ${color}`}>
                {React.cloneElement(icon, { className: 'h-10 w-10' })}
            </div>
            <div>
                <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">{title}</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-slate-100">{value}</p>
            </div>
        </CardContent>
    </Card>
);

interface LabDashboardProps {
    stats: Record<string, number>;
    onNavigateToList: () => void;
}

const LabDashboard: React.FC<LabDashboardProps> = ({ stats, onNavigateToList }) => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-6">Panel de Laboratorio</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={<InboxIcon/>} title="Nuevos para Recibir" value={stats[JobStatus.SentToLab] || 0} />
                <StatCard icon={<BriefcaseIcon/>} title="Trabajos en Proceso" value={stats[JobStatus.ReceivedByLab] || 0} color="text-indigo-500" />
                <StatCard icon={<AlertTriangleIcon/>} title="Prioridades Activas" value={stats.withAlerts || 0} color="text-yellow-500" />
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