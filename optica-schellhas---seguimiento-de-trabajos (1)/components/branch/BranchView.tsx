import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../../App';
import { JobStatus, JobPriority, type User, type Job, type BranchStats } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import JobCard from '../JobCard';
import { Button, Input, Card, CardHeader, CardContent, Select, Checkbox, StatCard } from '../common/UI';
import { PlusIcon, SendIcon, BriefcaseIcon, CalendarIcon, RepeatIcon, ClockIcon } from '../common/Icons';
import { JobHistoryModal } from '../common/JobHistoryModal';
import { Pagination } from '../common/Pagination';

const PAGE_SIZE = 10;

const BRANCH_PREFIXES: { [key: string]: string } = {
  'Casa central': 'C',
  'Paraguay': 'P',
  'Espana': 'E',
  'Libertad': 'L',
  'Paso del Bosque': 'X',
  'Balcarce': 'B',
};

const BranchDashboard: React.FC<{ user: User }> = ({ user }) => {
    const [stats, setStats] = useState<BranchStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const data = await api.apiGetBranchStats(user.id);
                setStats(data);
            } catch (e) {
                console.error("Failed to load branch stats", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [user.id]);

    return (
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-4">Métricas de la Sucursal</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    icon={<CalendarIcon />} 
                    title="Trabajos este mes"
                    value={stats?.jobsThisMonth ?? 0}
                    isLoading={isLoading}
                />
                <StatCard 
                    icon={<RepeatIcon />} 
                    title="% Repeticiones"
                    value={`${stats?.repetitionPercentage ?? 0}%`}
                    color="text-orange-500"
                    isLoading={isLoading}
                />
                <StatCard 
                    icon={<ClockIcon />} 
                    title="Entrega Promedio"
                    value={stats?.avgCompletionDays !== null ? `${stats?.avgCompletionDays} días` : 'N/A'}
                    color="text-green-500"
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
};


const BranchView: React.FC<{ user: User }> = ({ user }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [totalJobs, setTotalJobs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    
    const [filters, setFilters] = useState({
        searchTerm: '',
        status: 'ACTIVE_BRANCH' as 'ACTIVE_BRANCH' | 'HISTORY' | JobStatus,
        priorities: [] as JobPriority[],
        startDate: '',
        endDate: '',
    });
    const [sortBy, setSortBy] = useState<'updated_at' | 'priority'>('updated_at');

    const [jobNumber, setJobNumber] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const { addToast } = useToast();
    const branchPrefix = useMemo(() => BRANCH_PREFIXES[user.username] || user.username.charAt(0).toUpperCase(), [user.username]);

    const fetchJobs = useCallback(async () => {
        const { jobs, count } = await api.apiGetJobs(user, { 
            page: currentPage, 
            pageSize: PAGE_SIZE, 
            statusFilter: filters.status,
            searchTerm: filters.searchTerm,
            sortBy: sortBy,
            priorityFilter: filters.priorities,
            startDate: filters.startDate,
            endDate: filters.endDate
        });
        setJobs(jobs);
        setTotalJobs(count);
    }, [user, currentPage, filters, sortBy]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);
    
    // Reset page number when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, sortBy]);

    useEffect(() => {
        const channel = supabase
            .channel(`branch-jobs-channel-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `branch_id=eq.${user.id}` },
            (payload) => {
                fetchJobs();
            })
            .subscribe()

        return () => { supabase.removeChannel(channel); }
    }, [fetchJobs, user.id]);
    
    const handleCreateJob = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!jobNumber) {
            setError('El número de trabajo es obligatorio.');
            return;
        }
        try {
            const fullJobId = `${branchPrefix}-${jobNumber}`;
            await api.apiCreateJob({ id: fullJobId, description, branch_id: user.id, branch_name: user.username });
            addToast(`Trabajo #${fullJobId} creado exitosamente.`, 'success');
            setJobNumber('');
            setDescription('');
            fetchJobs();
        } catch (err: any) {
            setError(err.message);
        }
    }, [jobNumber, description, user, addToast, fetchJobs, branchPrefix]);
    
    const handleUpdate = useCallback(async (jobId: string, status: JobStatus) => {
        await api.apiUpdateJob(jobId, { status }, user);
        addToast(`Trabajo #${jobId} actualizado.`, 'success');
        fetchJobs();
    }, [user, addToast, fetchJobs]);
    
    const handleUpdatePriority = useCallback(async (jobId: string, priority: JobPriority, message: string) => {
        await api.apiUpdateJob(jobId, { priority, priority_message: message }, user);
        addToast(`Prioridad del trabajo #${jobId} actualizada.`, 'success');
        fetchJobs();
    }, [user, addToast, fetchJobs]);

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

    const jobsToSend = useMemo(() => 
        selectedJobIds.filter(id => jobs.some(j => j.id === id && j.status === JobStatus.PendingInBranch)),
        [selectedJobIds, jobs]
    );
    
    const handleBulkSendToLab = useCallback(async () => {
        if (jobsToSend.length === 0) return;
        await api.apiBulkUpdateJobs(jobsToSend, JobStatus.SentToLab, user);
        addToast(`${jobsToSend.length} trabajos enviados al laboratorio.`, 'success');
        setSelectedJobIds([]);
        fetchJobs();
    }, [jobsToSend, user, addToast, fetchJobs]);

    return (
        <div className="space-y-8">
            <BranchDashboard user={user} />
            <JobHistoryModal job={viewingJob} onClose={() => setViewingJob(null)} />
            <Card>
                <CardHeader><h2 className="text-xl font-bold dark:text-slate-100">Crear Nuevo Trabajo</h2></CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nº de Trabajo</label>
                            <div className="flex items-center">
                                <span className="inline-flex items-center px-3 h-[42px] rounded-l-md border border-r-0 border-gray-300 bg-gray-100 text-gray-600 dark:bg-slate-600 dark:border-slate-600 dark:text-slate-300">
                                    {branchPrefix}-
                                </span>
                                <Input 
                                    value={jobNumber} 
                                    onChange={e => setJobNumber(e.target.value.replace(/[a-zA-Z]/g, ''))} 
                                    required 
                                    placeholder="Ej: 12345"
                                    className="rounded-l-none"
                                />
                            </div>
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descripción (Opcional)</label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Progresivo antireflex, etc."/>
                        </div>
                        <div className="md:col-span-1">
                            <Button type="submit" className="w-full"><PlusIcon className="h-5 w-5 mr-2"/>Crear</Button>
                        </div>
                    </form>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </CardContent>
            </Card>

            {jobsToSend.length > 0 && (
                <div className="sticky top-[82px] md:top-[146px] z-30 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg shadow-md flex justify-between items-center">
                    <p className="font-semibold text-blue-800 dark:text-blue-200">{jobsToSend.length} trabajo(s) seleccionado(s).</p>
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

                <Card>
                    <CardHeader><h3 className="font-semibold dark:text-slate-200">Filtros y Búsqueda</h3></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Input 
                                value={filters.searchTerm}
                                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                placeholder="Buscar por Nº o descripción..."
                                className="lg:col-span-2"
                            />
                             <Select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                                <option value="ACTIVE_BRANCH">Todos Activos</option>
                                <option value={JobStatus.PendingInBranch}>Pendiente en Sucursal</option>
                                <option value={JobStatus.SentToLab}>Enviado a Lab</option>
                                <option value={JobStatus.ReceivedByLab}>Recibido en Lab</option>
                                <option value="HISTORY">Historial</option>
                            </Select>
                            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                                <option value="updated_at">Ordenar por Más Reciente</option>
                                <option value="priority">Ordenar por Prioridad</option>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha de Creación</label>
                                <div className="flex items-center gap-2">
                                    <Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
                                    <span className="text-gray-500">a</span>
                                    <Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {jobs.map(job => (
                            <JobCard 
                                key={job.id} 
                                job={job} 
                                user={user}
                                onUpdate={() => handleUpdate(job.id, JobStatus.SentToLab)}
                                onUpdatePriority={handleUpdatePriority}
                                onViewHistory={setViewingJob}
                                isSelected={selectedJobIds.includes(job.id)}
                                onSelect={handleSelectJob}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                        <p className="text-gray-500 dark:text-slate-400">
                           No se encontraron trabajos que coincidan con los filtros.
                        </p>
                    </div>
                )}
                 <Pagination 
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalJobs / PAGE_SIZE)}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
};

export default BranchView;
