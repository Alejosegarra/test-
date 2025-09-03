import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User, Job } from '../../types';
import { JobStatus, JobPriority } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../App';
import JobCard from '../JobCard';
import { Button, Input, Select, Checkbox, Card, CardHeader, CardContent } from '../common/UI';
import { CheckIcon, CheckCircleIcon, TruckIcon, SearchIcon } from '../common/Icons';
import { JobHistoryModal } from '../common/JobHistoryModal';
import { Pagination } from '../common/Pagination';

const PAGE_SIZE = 10;
type LabViewTab = JobStatus | 'HISTORY';

interface LabJobsListProps {
    user: User;
    tabCounts: Record<string, number>;
    onBack: () => void;
    onDataUpdate: () => void;
}

const LabJobsList: React.FC<LabJobsListProps> = ({ user, tabCounts, onBack, onDataUpdate }) => {
    const [activeTab, setActiveTab] = useState<LabViewTab>(JobStatus.SentToLab);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [totalJobs, setTotalJobs] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [filters, setFilters] = useState({
        searchTerm: '',
        priorities: [] as JobPriority[],
        startDate: '',
        endDate: '',
        branchId: '',
    });
    const [sortBy, setSortBy] = useState<'updated_at' | 'priority'>('updated_at');

    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const [newJobAlerts, setNewJobAlerts] = useState<Set<JobStatus>>(new Set());
    const { addToast } = useToast();

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const branchesData = await api.apiGetAllBranches();
                setBranches(branchesData);
            } catch (error) {
                addToast('No se pudieron cargar las sucursales.', 'error');
            }
        };
        fetchBranches();
    }, [addToast]);

    const fetchJobs = useCallback(async () => {
        const response = await api.apiGetJobs(user, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            statusFilter: activeTab,
            searchTerm: filters.searchTerm,
            sortBy: sortBy,
            priorityFilter: filters.priorities,
            startDate: filters.startDate,
            endDate: filters.endDate,
            branchIdFilter: filters.branchId,
        });
        setJobs(response.jobs);
        setTotalJobs(response.count);
    }, [user, currentPage, activeTab, filters, sortBy]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);
    
    useEffect(() => {
        setCurrentPage(1);
        setFilters(f => ({...f, searchTerm: ''}));
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, sortBy]);

    useEffect(() => {
        const channel = supabase
            .channel('lab-jobs-list-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, 
            (payload) => {
                const newStatus = payload.new.status as JobStatus;
                if(newStatus !== activeTab && (newStatus === JobStatus.SentToLab || newStatus === JobStatus.ReceivedByLab || newStatus === JobStatus.Completed)) {
                    setNewJobAlerts(prev => new Set(prev).add(newStatus));
                }
                // Refetch current page on any change
                fetchJobs();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, fetchJobs)
            .subscribe();
        
        return () => { supabase.removeChannel(channel); };
    }, [activeTab, fetchJobs]);

    const handleUpdate = useCallback(async (jobId: string, currentStatus: JobStatus) => {
        let nextStatus: JobStatus | null = null;
        if(currentStatus === JobStatus.SentToLab) nextStatus = JobStatus.ReceivedByLab;
        if(currentStatus === JobStatus.ReceivedByLab) nextStatus = JobStatus.Completed;
        if(currentStatus === JobStatus.Completed) nextStatus = JobStatus.SentToBranch;
        
        if (nextStatus) {
            await api.apiUpdateJob(jobId, { status: nextStatus }, user);
            addToast(`Trabajo #${jobId} actualizado a ${nextStatus}.`, 'success');
            fetchJobs();
            onDataUpdate();
        }
    }, [user, addToast, fetchJobs, onDataUpdate]);
    
    const handleBulkUpdate = useCallback(async () => {
        const jobsToUpdate = selectedJobIds.filter(id => jobs.some(j => j.id === id && j.status === activeTab));
        if (jobsToUpdate.length === 0) return;

        let nextStatus: JobStatus | null = null;
        if(activeTab === JobStatus.SentToLab) nextStatus = JobStatus.ReceivedByLab;
        if(activeTab === JobStatus.ReceivedByLab) nextStatus = JobStatus.Completed;
        if(activeTab === JobStatus.Completed) nextStatus = JobStatus.SentToBranch;

        if (nextStatus) {
            await api.apiBulkUpdateJobs(jobsToUpdate, nextStatus, user);
            addToast(`${jobsToUpdate.length} trabajos actualizados a ${nextStatus}.`, 'success');
            setSelectedJobIds([]);
            fetchJobs();
            onDataUpdate();
        }
    }, [activeTab, jobs, selectedJobIds, user, addToast, fetchJobs, onDataUpdate]);

    const handleUpdatePriority = useCallback(async (jobId: string, priority: JobPriority, message: string) => {
        await api.apiUpdateJob(jobId, { priority, priority_message: message }, user);
        addToast(`Prioridad del trabajo #${jobId} actualizada.`, 'success');
        fetchJobs();
        onDataUpdate();
    }, [user, addToast, fetchJobs, onDataUpdate]);
    
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
    };

    const tabs: {status: LabViewTab, label: string}[] = [
        {status: JobStatus.SentToLab, label: "Recibidos de Sucursal"},
        {status: JobStatus.ReceivedByLab, label: "En Proceso"},
        {status: JobStatus.Completed, label: "Terminados (Enviar a Sucursal)"},
        {status: 'HISTORY', label: "Historial"}
    ];
    
    const jobsForBulkAction = selectedJobIds.filter(id => jobs.some(j => j.id === id));
    const bulkActionInfo = useMemo(() => {
        switch(activeTab) {
            case JobStatus.SentToLab: return { label: 'Marcar como Recibidos', icon: <CheckIcon className="h-4 w-4 mr-2"/>};
            case JobStatus.ReceivedByLab: return { label: 'Marcar como Terminados', icon: <CheckCircleIcon className="h-4 w-4 mr-2"/>};
            case JobStatus.Completed: return { label: 'Enviar a Sucursal', icon: <TruckIcon className="h-4 w-4 mr-2"/>};
            default: return null;
        }
    }, [activeTab]);

    const getTabCount = (status: LabViewTab) => {
        if (status === 'HISTORY') {
            // El historial del laboratorio ahora solo muestra trabajos enviados a sucursal.
            return tabCounts[JobStatus.SentToBranch] || 0;
        }
        return tabCounts[status as JobStatus] || 0;
    };

    return (
        <div>
            <JobHistoryModal job={viewingJob} onClose={() => setViewingJob(null)} />
            <Button variant="ghost" onClick={onBack} className="mb-4 -ml-4">&larr; Volver al Panel</Button>
            
            <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6 overflow-x-auto">
                {tabs.map(tab => (
                     <button 
                        key={tab.status}
                        onClick={() => {
                            setActiveTab(tab.status)
                            setSelectedJobIds([]);
                            setNewJobAlerts(prev => {
                                const next = new Set(prev);
                                next.delete(tab.status as JobStatus);
                                return next;
                            });
                        }} 
                        className={`relative py-2 px-4 text-sm md:text-base font-medium whitespace-nowrap ${activeTab === tab.status ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 dark:text-slate-400'}`}
                    >
                        {tab.label} ({getTabCount(tab.status)})
                        {newJobAlerts.has(tab.status as JobStatus) && <span className="absolute top-2 right-1 block h-2 w-2 rounded-full bg-red-500" />}
                    </button>
                ))}
            </div>
            
            {jobsForBulkAction.length > 0 && bulkActionInfo && (
                <div className="sticky top-[82px] z-30 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg shadow-md flex justify-between items-center mb-6">
                    <p className="font-semibold text-blue-800 dark:text-blue-200">{jobsForBulkAction.length} trabajo(s) seleccionado(s).</p>
                    <Button onClick={handleBulkUpdate}>
                       {bulkActionInfo.icon} {bulkActionInfo.label}
                    </Button>
                </div>
            )}

            <Card className="mb-6">
                <CardHeader><h3 className="font-semibold dark:text-slate-200">Filtros y Búsqueda</h3></CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Input 
                                value={filters.searchTerm}
                                onChange={e => handleFilterChange('searchTerm', e.target.value)}
                                placeholder="Buscar por Nº, descripción o sucursal..."
                                className="pl-10"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/>
                        </div>
                        <Select value={filters.branchId} onChange={(e) => handleFilterChange('branchId', e.target.value)} className="w-full md:w-auto">
                            <option value="">Todas las sucursales</option>
                            {branches.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.username}</option>
                            ))}
                        </Select>
                        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full md:w-auto">
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
                                            <span className="dark:text-slate-200">{p}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                </CardContent>
            </Card>

            {jobs.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {jobs.map(job => (
                            <JobCard 
                                key={job.id} 
                                job={job} 
                                user={user}
                                onUpdate={() => handleUpdate(job.id, job.status)}
                                onUpdatePriority={handleUpdatePriority}
                                onViewHistory={setViewingJob}
                                isSelected={selectedJobIds.includes(job.id)}
                                onSelect={activeTab !== 'HISTORY' ? handleSelectJob : () => {}}
                            />
                        ))}
                    </div>
                     <Pagination 
                        currentPage={currentPage}
                        totalPages={Math.ceil(totalJobs / PAGE_SIZE)}
                        onPageChange={setCurrentPage}
                    />
                </>
            ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-gray-500 dark:text-slate-400">No hay trabajos que coincidan con la búsqueda en este estado.</p>
                </div>
            )}
        </div>
    );
};

export default LabJobsList;