import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast, useRefresh } from '../../App';
import { JobStatus, JobPriority, JobType, type User, type Job, type BranchViewTab } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import JobCard from '../JobCard';
import { Button, Input, Card, CardHeader, CardContent, Checkbox } from '../common/UI';
import { PlusIcon, SendIcon, BriefcaseIcon, GridIcon, ListIcon, InboxIcon, AlertTriangleIcon } from '../common/Icons';
import { JobHistoryModal } from '../common/JobHistoryModal';
import { Pagination } from '../common/Pagination';
import { JobRow } from '../common/JobRow';
import { OverdueJobsWarning } from '../common/OverdueJobsWarning';
import { calculateBusinessHours } from '../../services/timeUtils';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const BRANCH_PREFIXES: { [key: string]: string } = {
  'Casa central': 'C',
  'Paraguay': 'P',
  'Espana': 'E',
  'Libertad': 'L',
  'Paso del Bosque': 'X',
  'Balcarce': 'B',
};

const TABS: { id: BranchViewTab; label: string }[] = [
    { id: 'toSend', label: 'Para Enviar' },
    { id: 'inProcess', label: 'En Proceso' },
    { id: 'toReceive', label: 'Para Recibir' },
    { id: 'history', label: 'Historial' },
];

const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactElement<{ className?: string }>;
    color: string;
    onClick: () => void;
}> = ({ title, value, icon, color, onClick }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
        <CardContent className="flex items-center">
            <div className={`p-3 rounded-full mr-4 ${color.replace('text-', 'bg-').replace('500', '100')} dark:bg-slate-700`}>
                {React.cloneElement(icon, { className: `h-6 w-6 ${color}` })}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
            </div>
        </CardContent>
    </Card>
);

const BranchView: React.FC<{ user: User }> = ({ user }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [totalJobs, setTotalJobs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const [activeTab, setActiveTab] = useState<BranchViewTab>('toSend');
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [stats, setStats] = useState({ toSend: 0, inLab: 0, toReceive: 0, activeAlerts: 0 });
    const [overdueJobs, setOverdueJobs] = useState<Job[]>([]);
    
    const [filters, setFilters] = useState({
        searchTerm: '',
        priorities: [] as JobPriority[],
        startDate: '',
        endDate: '',
    });
    const [sortBy, setSortBy] = useState<'updated_at' | 'priority' | 'id_asc' | 'id_desc'>('updated_at');

    const [jobType, setJobType] = useState<JobType>(JobType.Nuevo);
    const [jobNumber, setJobNumber] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const { addToast } = useToast();
    const { refreshKey } = useRefresh();
    const branchPrefix = useMemo(() => BRANCH_PREFIXES[user.username] || user.username.charAt(0).toUpperCase(), [user.username]);

    const fetchStats = useCallback(async () => {
        try {
            const branchStats = await api.apiGetBranchStats(user.id);
            setStats(branchStats);
        } catch (error) {
            addToast('No se pudo cargar el resumen.', 'error');
        }
    }, [user.id, addToast]);

    const fetchJobs = useCallback(async () => {
        let statusFilter: JobStatus | JobStatus[] | undefined;
        switch (activeTab) {
            case 'toSend':
                statusFilter = JobStatus.PendingInBranch;
                break;
            case 'inProcess':
                statusFilter = [JobStatus.SentToLab, JobStatus.ReceivedByLab, JobStatus.Completed];
                break;
            case 'toReceive':
                statusFilter = JobStatus.SentToBranch;
                break;
            case 'history':
                statusFilter = JobStatus.ReceivedByBranch;
                break;
        }

        const { jobs, count } = await api.apiGetJobs(user, { 
            page: currentPage, 
            pageSize: pageSize, 
            statusFilter: statusFilter,
            searchTerm: filters.searchTerm,
            sortBy: sortBy,
            priorityFilter: filters.priorities,
            startDate: filters.startDate,
            endDate: filters.endDate
        });
        setJobs(jobs);
        setTotalJobs(count);
    }, [user, currentPage, pageSize, filters, sortBy, activeTab]);

    const fetchOverdueJobs = useCallback(async () => {
        try {
            const potentiallyOverdue = await api.apiGetPotentiallyOverdueJobs();
            const overdueForThisBranch = potentiallyOverdue.filter(job => {
                if (job.branch_id !== user.id || job.status !== JobStatus.SentToBranch) {
                    return false;
                }
                const sentEntry = [...job.history].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).find(h => h.status === JobStatus.SentToBranch);
                if (!sentEntry) return false;

                return calculateBusinessHours(sentEntry.timestamp) > 48;
            });
            setOverdueJobs(overdueForThisBranch);
        } catch (error) {
            console.error("Failed to fetch overdue jobs", error);
            addToast('Error al verificar trabajos demorados.', 'error');
        }
    }, [user.id, addToast]);

    useEffect(() => {
        fetchJobs();
        fetchStats();
        fetchOverdueJobs();
    }, [fetchJobs, fetchStats, fetchOverdueJobs, refreshKey]);
    
    useEffect(() => {
        setCurrentPage(1);
        setSelectedJobIds([]);
    }, [filters, sortBy, activeTab, pageSize]);

    useEffect(() => {
        const channel = supabase
            .channel(`branch-jobs-channel-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `branch_id=eq.${user.id}` },
            () => {
                fetchJobs();
                fetchStats();
                fetchOverdueJobs();
            })
            .subscribe()

        return () => { supabase.removeChannel(channel); }
    }, [fetchJobs, fetchStats, fetchOverdueJobs, user.id]);
    
    const handleCreateJob = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!jobNumber) {
            setError('El número de trabajo es obligatorio.');
            return;
        }
        try {
            const fullJobId = jobType === JobType.Nuevo ? `${branchPrefix}-${jobNumber}` : jobNumber;
            await api.apiCreateJob({ id: fullJobId, description, branch_id: user.id, branch_name: user.username, job_type: jobType });
            addToast(`Trabajo #${fullJobId} creado exitosamente.`, 'success');
            setJobNumber('');
            setDescription('');
            setActiveTab('toSend');
            if (currentPage === 1 && activeTab === 'toSend') {
                fetchJobs();
                fetchStats();
            } else {
                setCurrentPage(1);
            }
        } catch (err: any) {
            setError(err.message);
        }
    }, [jobNumber, description, user, addToast, fetchJobs, fetchStats, branchPrefix, jobType, currentPage, activeTab]);
    
    const handleUpdate = useCallback(async (job: Job) => {
        let nextStatus: JobStatus | null = null;
        if (job.status === JobStatus.PendingInBranch) {
            nextStatus = JobStatus.SentToLab;
        } else if (job.status === JobStatus.SentToBranch) {
            nextStatus = JobStatus.ReceivedByBranch;
        }
        
        if (nextStatus) {
            await api.apiUpdateJob(job.id, { status: nextStatus }, user);
            addToast(`Trabajo #${job.id} actualizado.`, 'success');
            fetchJobs();
            fetchStats();
        }
    }, [user, addToast, fetchJobs, fetchStats]);
    
    const handleUpdatePriority = useCallback(async (jobId: string, priority: JobPriority, message: string) => {
        await api.apiUpdateJob(jobId, { priority, priority_message: message }, user);
        addToast(`Prioridad del trabajo #${jobId} actualizada.`, 'success');
        fetchJobs();
        fetchStats();
    }, [user, addToast, fetchJobs, fetchStats]);

    const handleSelectJob = (jobId: string, isSelected: boolean) => {
        setSelectedJobIds(prev => isSelected ? [...prev, jobId] : prev.filter(id => id !== jobId));
    };
    
    const handleFilterChange = (key: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handlePriorityFilterChange = (priority: JobPriority, checked: boolean) => {
        setFilters(prev => ({
            ...prev,
            priorities: checked
                ? [...prev.priorities, priority]
                : prev.priorities.filter(p => p !== priority)
        }));
    }
    
    const handleBulkSendToLab = useCallback(async () => {
        if (selectedJobIds.length === 0) return;
        await api.apiBulkUpdateJobs(selectedJobIds, JobStatus.SentToLab, user);
        addToast(`${selectedJobIds.length} trabajos enviados al laboratorio.`, 'success');
        setSelectedJobIds([]);
        fetchJobs();
        fetchStats();
    }, [selectedJobIds, user, addToast, fetchJobs, fetchStats]);

    const handleStatCardClick = (tab: BranchViewTab, newFilters: Partial<typeof filters> = {}) => {
        setActiveTab(tab);
        setFilters(prev => ({
            ...prev,
            searchTerm: '',
            priorities: [], // Reset priorities unless specified
            startDate: '',
            endDate: '',
            ...newFilters,
        }));
    };

    const handleOverdueJobClick = (job: Job) => {
        setActiveTab('toReceive');
        setFilters(prev => ({ ...prev, searchTerm: job.id }));
        addToast(`Filtro aplicado para el trabajo #${job.id}.`, 'success');
    };

    return (
        <div className="space-y-8">
            <JobHistoryModal job={viewingJob} onClose={() => setViewingJob(null)} />
            
            <OverdueJobsWarning
                jobs={overdueJobs}
                title="¡Atención! Trabajos demorados para recibir"
                description="Los siguientes trabajos fueron enviados por el laboratorio hace más de 48hs hábiles y aún no han sido marcados como recibidos."
                onJobClick={handleOverdueJobClick}
            />

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Para Enviar"
                    value={stats.toSend}
                    icon={<SendIcon />}
                    color="text-blue-500"
                    onClick={() => handleStatCardClick('toSend')}
                />
                <StatCard 
                    title="En Laboratorio"
                    value={stats.inLab}
                    icon={<BriefcaseIcon />}
                    color="text-indigo-500"
                    onClick={() => handleStatCardClick('inProcess')}
                />
                <StatCard 
                    title="Para Recibir"
                    value={stats.toReceive}
                    icon={<InboxIcon />}
                    color="text-purple-500"
                    onClick={() => handleStatCardClick('toReceive')}
                />
                <StatCard 
                    title="Alertas Activas"
                    value={stats.activeAlerts}
                    icon={<AlertTriangleIcon />}
                    color="text-yellow-500"
                    onClick={() => handleStatCardClick('inProcess', { priorities: [JobPriority.Urgente, JobPriority.Repeticion] })}
                />
            </div>

            <Card>
                <CardHeader><h2 className="text-xl font-bold dark:text-slate-100">Crear Nuevo Trabajo</h2></CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateJob} className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <span className="font-medium dark:text-slate-300">Tipo:</span>
                             <label className="flex items-center space-x-2 cursor-pointer">
                                <span className={jobType === JobType.Nuevo ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Trabajo Nuevo</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setJobType(jobType === JobType.Nuevo ? JobType.Reparacion : JobType.Nuevo)}
                                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${jobType === JobType.Reparacion ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                                aria-pressed={jobType === JobType.Reparacion}
                            >
                                <span className="sr-only">Seleccionar tipo de trabajo</span>
                                <span
                                    aria-hidden="true"
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${jobType === JobType.Reparacion ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <span className={jobType === JobType.Reparacion ? 'text-blue-600 font-semibold' : 'text-gray-500'}>Reparación</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nº de Trabajo</label>
                                {jobType === JobType.Nuevo ? (
                                    <div className="flex items-center">
                                        <span className="inline-flex items-center px-3 h-[42px] rounded-l-md border border-r-0 border-gray-300 bg-gray-100 text-gray-600 dark:bg-slate-600 dark:border-slate-600 dark:text-slate-300">
                                            {branchPrefix}-
                                        </span>
                                        <Input 
                                            value={jobNumber} 
                                            onChange={e => setJobNumber(e.target.value.replace(/\D/g, ''))} 
                                            required 
                                            placeholder="Ej: 12345"
                                            className="rounded-l-none"
                                        />
                                    </div>
                                ) : (
                                    <Input 
                                        value={jobNumber} 
                                        onChange={e => setJobNumber(e.target.value)} 
                                        required 
                                        placeholder="Ej: REP-543"
                                    />
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descripción (Opcional)</label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Progresivo antireflex, etc."/>
                            </div>
                            <div className="md:col-span-1">
                                <Button type="submit" className="w-full"><PlusIcon className="h-5 w-5 mr-2"/>Crear</Button>
                            </div>
                        </div>
                    </form>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </CardContent>
            </Card>

            {activeTab === 'toSend' && selectedJobIds.length > 0 && (
                <div className="sticky top-[82px] md:top-[146px] z-30 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg shadow-md flex justify-between items-center animate-fadeIn">
                    <p className="font-semibold text-blue-800 dark:text-blue-200">{selectedJobIds.length} trabajo(s) seleccionado(s).</p>
                    <Button onClick={handleBulkSendToLab}>
                        <SendIcon className="h-4 w-4 mr-2"/> Enviar seleccionados al Laboratorio
                    </Button>
                </div>
            )}

            <div className="space-y-6">
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 flex items-center">
                    <BriefcaseIcon className="h-6 w-6 mr-3 text-gray-500 dark:text-slate-400"/>
                    Gestión de Trabajos
                </h2>
                
                 <div className="border-b border-gray-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${
                            tab.id === activeTab
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            {tab.label}
                        </button>
                        ))}
                    </nav>
                </div>

                <Card>
                    <CardHeader className="flex justify-between items-center">
                        <h3 className="font-semibold dark:text-slate-200">Filtros y Búsqueda</h3>
                        <div className="flex items-center space-x-1 bg-gray-200 dark:bg-slate-700 rounded-lg p-1">
                            <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('card')} className={`${viewMode === 'card' ? 'bg-white dark:bg-slate-600' : ''} !p-2`} aria-label="Vista de tarjetas"><GridIcon className="h-5 w-5"/></Button>
                            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className={`${viewMode === 'list' ? 'bg-white dark:bg-slate-600' : ''} !p-2`} aria-label="Vista de lista"><ListIcon className="h-5 w-5"/></Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Input 
                                value={filters.searchTerm}
                                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                placeholder="Buscar por Nº o descripción..."
                                className="lg:col-span-2"
                            />
                             <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white text-gray-900 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                                <option value="updated_at">Ordenar por Más Reciente</option>
                                <option value="priority">Ordenar por Prioridad</option>
                                <option value="id_asc">Ordenar por Nº Trabajo (Asc)</option>
                                <option value="id_desc">Ordenar por Nº Trabajo (Desc)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha de Creación</label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={e => handleFilterChange('startDate', e.target.value)}
                                    />
                                    <span className="text-gray-500">a</span>
                                    <Input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={e => handleFilterChange('endDate', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
                                <div className="flex items-center space-x-4 pt-2">
                                    {Object.values(JobPriority).map(p => (
                                        <label key={p} className="flex items-center space-x-2 cursor-pointer">
                                            <Checkbox checked={filters.priorities.includes(p)} onChange={e => handlePriorityFilterChange(p, e.target.checked)} />
                                            <span>{p}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {jobs.length > 0 ? (
                     viewMode === 'card' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {jobs.map(job => (
                                <JobCard 
                                    key={job.id} 
                                    job={job} 
                                    user={user}
                                    onUpdate={() => handleUpdate(job)}
                                    onUpdatePriority={handleUpdatePriority}
                                    onViewHistory={setViewingJob}
                                    selectable={activeTab === 'toSend'}
                                    isSelected={selectedJobIds.includes(job.id)}
                                    onSelect={activeTab === 'toSend' ? handleSelectJob : () => {}}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b dark:border-slate-700">
                                        <tr>
                                            <th className="p-3"></th>
                                            <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">#</th>
                                            <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Descripción</th>
                                            <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden sm:table-cell">Estado</th>
                                            <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden md:table-cell">Prioridad</th>
                                            <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden lg:table-cell">Última Act.</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map(job => (
                                            <JobRow
                                                key={job.id}
                                                job={job}
                                                user={user}
                                                onUpdate={() => handleUpdate(job)}
                                                onUpdatePriority={handleUpdatePriority}
                                                onViewHistory={setViewingJob}
                                                selectable={activeTab === 'toSend'}
                                                isSelected={selectedJobIds.includes(job.id)}
                                                onSelect={activeTab === 'toSend' ? handleSelectJob : () => {}}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                        <p className="text-gray-500 dark:text-slate-400">
                           No se encontraron trabajos que coincidan con los filtros en esta vista.
                        </p>
                    </div>
                )}
                 <Pagination 
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalJobs / pageSize)}
                    onPageChange={setCurrentPage}
                    totalItems={totalJobs}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                />
            </div>
        </div>
    );
};

export default BranchView;