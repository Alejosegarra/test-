import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../../App';
import { JobStatus, JobPriority, type User, type Job } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import JobCard from '../JobCard';
import { Button, Input, Card, CardHeader, CardContent, Select } from '../common/UI';
import { PlusIcon, SendIcon, BriefcaseIcon, HistoryIcon, SearchIcon } from '../common/Icons';
import { JobHistoryModal } from '../common/JobHistoryModal';
import { Pagination } from '../common/Pagination';

const PAGE_SIZE = 10;

const BranchView: React.FC<{ user: User }> = ({ user }) => {
    const [activeJobs, setActiveJobs] = useState<Job[]>([]);
    const [historicalJobs, setHistoricalJobs] = useState<Job[]>([]);
    
    const [activeCurrentPage, setActiveCurrentPage] = useState(1);
    const [historicalCurrentPage, setHistoricalCurrentPage] = useState(1);
    const [totalActive, setTotalActive] = useState(0);
    const [totalHistorical, setTotalHistorical] = useState(0);

    const [activeSearchTerm, setActiveSearchTerm] = useState('');
    const [historicalSearchTerm, setHistoricalSearchTerm] = useState('');
    const [activeSortBy, setActiveSortBy] = useState<'updated_at' | 'priority'>('updated_at');

    const [jobNumber, setJobNumber] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const { addToast } = useToast();

    const fetchActiveJobs = useCallback(async () => {
        const { jobs, count } = await api.apiGetJobs(user, { 
            page: activeCurrentPage, 
            pageSize: PAGE_SIZE, 
            status: 'ACTIVE_BRANCH',
            searchTerm: activeSearchTerm,
            sortBy: activeSortBy
        });
        setActiveJobs(jobs);
        setTotalActive(count);
    }, [user, activeCurrentPage, activeSearchTerm, activeSortBy]);

    const fetchHistoricalJobs = useCallback(async () => {
        const { jobs, count } = await api.apiGetJobs(user, { 
            page: historicalCurrentPage, 
            pageSize: PAGE_SIZE, 
            status: 'HISTORY',
            searchTerm: historicalSearchTerm
        });
        setHistoricalJobs(jobs);
        setTotalHistorical(count);
    }, [user, historicalCurrentPage, historicalSearchTerm]);

    useEffect(() => { fetchActiveJobs(); }, [fetchActiveJobs]);
    useEffect(() => { fetchHistoricalJobs(); }, [fetchHistoricalJobs]);

    useEffect(() => {
        const channel = supabase
            .channel(`branch-jobs-channel-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `branch_id=eq.${user.id}` },
            (payload) => {
                fetchActiveJobs();
                fetchHistoricalJobs();
            })
            .subscribe()

        return () => { supabase.removeChannel(channel); }
    }, [fetchActiveJobs, fetchHistoricalJobs, user.id]);
    
    const handleCreateJob = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await api.apiCreateJob({ id: jobNumber, description, branch_id: user.id, branch_name: user.username });
            addToast(`Trabajo #${jobNumber} creado exitosamente.`, 'success');
            setJobNumber('');
            setDescription('');
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleUpdate = async (jobId: string, status: JobStatus) => {
        await api.apiUpdateJob(jobId, { status }, user);
        addToast(`Trabajo #${jobId} actualizado.`, 'success');
    };
    
    const handleUpdatePriority = async (jobId: string, priority: JobPriority, message: string) => {
        await api.apiUpdateJob(jobId, { priority, priority_message: message }, user);
        addToast(`Prioridad del trabajo #${jobId} actualizada.`, 'success');
    };

    const handleSelectJob = (jobId: string, isSelected: boolean) => {
        setSelectedJobIds(prev => isSelected ? [...prev, jobId] : prev.filter(id => id !== jobId));
    };

    const jobsToSend = selectedJobIds.filter(id => activeJobs.some(j => j.id === id && j.status === JobStatus.PendingInBranch));
    
    const handleBulkSendToLab = async () => {
        if (jobsToSend.length === 0) return;
        await api.apiBulkUpdateJobs(jobsToSend, JobStatus.SentToLab, user);
        addToast(`${jobsToSend.length} trabajos enviados al laboratorio.`, 'success');
        setSelectedJobIds([]);
    };
    
    const statusOrder: JobStatus[] = [JobStatus.PendingInBranch, JobStatus.SentToLab, JobStatus.ReceivedByLab, JobStatus.Completed];
    
    const groupedActiveJobs = useMemo(() => {
        return activeJobs.reduce((acc, job) => {
            if (!acc[job.status]) acc[job.status] = [];
            acc[job.status].push(job);
            return acc;
        }, {} as Record<JobStatus, Job[]>);
    }, [activeJobs]);

    return (
        <div className="space-y-8">
            <JobHistoryModal job={viewingJob} onClose={() => setViewingJob(null)} />
            <Card>
                <CardHeader><h2 className="text-xl font-bold">Crear Nuevo Trabajo</h2></CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Nº de Trabajo</label>
                            <Input value={jobNumber} onChange={e => setJobNumber(e.target.value)} required placeholder="Ej: 12345"/>
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
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
                <div className="sticky top-[82px] md:top-[146px] z-30 bg-blue-100 p-3 rounded-lg shadow-md flex justify-between items-center">
                    <p className="font-semibold text-blue-800">{jobsToSend.length} trabajo(s) seleccionado(s).</p>
                    <Button onClick={handleBulkSendToLab}>
                        <SendIcon className="h-4 w-4 mr-2"/> Enviar seleccionados al Laboratorio
                    </Button>
                </div>
            )}

            <div className="space-y-6">
                 <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <BriefcaseIcon className="h-6 w-6 mr-3 text-gray-500"/>
                    Trabajos Activos
                </h2>

                <Card>
                    <CardContent className="flex flex-col md:flex-row gap-4">
                        <Input 
                            value={activeSearchTerm}
                            onChange={(e) => { setActiveSearchTerm(e.target.value); setActiveCurrentPage(1); }}
                            placeholder="Buscar en trabajos activos..."
                            className="flex-grow"
                        />
                        <Select
                            value={activeSortBy}
                            onChange={(e) => setActiveSortBy(e.target.value as any)}
                            className="w-full md:w-auto"
                        >
                            <option value="updated_at">Ordenar por Más Reciente</option>
                            <option value="priority">Ordenar por Prioridad</option>
                        </Select>
                    </CardContent>
                </Card>

                {statusOrder.map(status => (
                    groupedActiveJobs[status] && groupedActiveJobs[status].length > 0 && (
                        <div key={status}>
                             <h3 className="text-xl font-semibold mb-3 text-gray-700">{status}</h3>
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {groupedActiveJobs[status].map(job => (
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
                        </div>
                    )
                ))}
                 {activeJobs.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg shadow-md">
                        <p className="text-gray-500">
                           No hay trabajos activos que coincidan con la búsqueda.
                        </p>
                    </div>
                )}
                 <Pagination 
                    currentPage={activeCurrentPage}
                    totalPages={Math.ceil(totalActive / PAGE_SIZE)}
                    onPageChange={setActiveCurrentPage}
                />
            </div>
            
            <div className="space-y-4">
                <div className="border-t pt-8">
                     <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center"><HistoryIcon className="h-6 w-6 mr-3 text-gray-500"/>Historial de Trabajos</h2>
                     <div className="relative">
                        <Input 
                            value={historicalSearchTerm}
                            onChange={(e) => { setHistoricalSearchTerm(e.target.value); setHistoricalCurrentPage(1); }}
                            placeholder="Buscar en historial por Nº o descripción..."
                            className="pl-10"
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/>
                    </div>
                </div>

                 {historicalJobs.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {historicalJobs.map(job => (
                                <JobCard 
                                    key={job.id} 
                                    job={job} 
                                    user={user}
                                    onUpdate={() => {}}
                                    onUpdatePriority={handleUpdatePriority}
                                    onViewHistory={setViewingJob}
                                    isSelected={false} // No selection in history
                                    onSelect={() => {}}
                                />
                            ))}
                        </div>
                        <Pagination 
                            currentPage={historicalCurrentPage}
                            totalPages={Math.ceil(totalHistorical / PAGE_SIZE)}
                            onPageChange={setHistoricalCurrentPage}
                        />
                    </>
                 ) : (
                    <div className="text-center py-12 bg-white rounded-lg shadow-md">
                        <p className="text-gray-500">No hay trabajos en el historial que coincidan con su búsqueda.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default BranchView;
