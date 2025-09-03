import React, { useState, useEffect, useCallback } from 'react';
import { useToast, useRefresh } from '../../App';
import { JobStatus, JobPriority, type User, type Job } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { Button, Input, Modal, Card, CardHeader, CardContent, Select, Checkbox } from '../common/UI';
import { BriefcaseIcon, PlusIcon, EditIcon, TrashIcon } from '../common/Icons';
import { Pagination } from '../common/Pagination';

const PAGE_SIZE = 15;

const JobRowCard: React.FC<{ job: Job, onEdit: (job: Job) => void, onDelete: (job: Job) => void }> = ({ job, onEdit, onDelete }) => (
    <Card className="mb-4">
        <CardContent>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-mono text-sm text-gray-900 dark:text-slate-200">#{job.id}</p>
                    <p className="text-gray-800 dark:text-slate-100 font-semibold">{job.description || "Sin descripción"}</p>
                </div>
                <div className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(job)} title="Editar trabajo">
                        <EditIcon className="h-5 w-5 text-gray-600 dark:text-slate-300"/>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(job)} title="Eliminar trabajo">
                        <TrashIcon className="h-5 w-5 text-red-500"/>
                    </Button>
                </div>
            </div>
            <div className="mt-4 text-sm text-gray-600 dark:text-slate-400 space-y-1">
                <p><strong>Sucursal:</strong> {job.branch_name}</p>
                <p><strong>Estado:</strong> {job.status}</p>
                <p><strong>Prioridad:</strong> {job.priority}</p>
            </div>
        </CardContent>
    </Card>
);

const ManageJobs: React.FC<{ user: User }> = ({ user }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: 'ALL' as JobStatus | 'ALL',
        branchId: '',
        priorities: [] as JobPriority[],
        startDate: '',
        endDate: '',
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<Partial<Job> | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingJob, setDeletingJob] = useState<Job | null>(null);
    const { addToast } = useToast();
    const { refreshKey } = useRefresh();
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalJobs, setTotalJobs] = useState(0);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [jobsResponse, branchesData] = await Promise.all([
                api.apiGetJobs(user, {
                    page: currentPage,
                    pageSize: PAGE_SIZE,
                    searchTerm,
                    statusFilter: filters.status,
                    branchIdFilter: filters.branchId,
                    priorityFilter: filters.priorities,
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                }),
                api.apiGetAllBranches(),
            ]);
            setJobs(jobsResponse.jobs);
            setTotalJobs(jobsResponse.count);
            setBranches(branchesData);
        } catch (error) {
            addToast('Error al cargar datos.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, addToast, currentPage, searchTerm, filters]);
    
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData, refreshKey]);

    useEffect(() => {
        // Reset to first page whenever filters change
        setCurrentPage(1);
    }, [searchTerm, filters]);

    useEffect(() => {
        const channel = supabase
            .channel('public:jobs:admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchAllData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAllData]);

    const handleOpenModal = (job: Job | null = null) => {
        setEditingJob(job ? { ...job } : { priority: JobPriority.Normal, status: JobStatus.PendingInBranch, branch_id: branches[0]?.id });
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingJob(null);
    };

    const handleSaveJob = async () => {
        if (!editingJob) return;
        
        try {
            const branch = branches.find(b => b.id === editingJob.branch_id);
            if (!branch) {
                addToast('Sucursal inválida seleccionada.', 'error');
                return;
            }
            const jobData = { ...editingJob, branch_name: branch.username };

            if (jobData.created_at) { // Editing existing job
                await api.apiUpdateJob(jobData.id!, jobData, user);
                addToast(`Trabajo #${jobData.id} actualizado.`, 'success');
            } else { // Creating new job
                 if (!jobData.id) {
                    addToast('El número de trabajo es obligatorio.', 'error');
                    return;
                }
                await api.apiCreateJob({
                    id: jobData.id,
                    description: jobData.description || '',
                    branch_id: branch.id,
                    branch_name: branch.username
                });
                addToast(`Trabajo #${jobData.id} creado.`, 'success');
            }
            handleCloseModal();
            fetchAllData(); // Refresh data
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
    const handleOpenDeleteModal = (job: Job) => {
        setDeletingJob(job);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingJob) return;
        try {
            await api.apiDeleteJob(deletingJob.id);
            addToast(`Trabajo #${deletingJob.id} eliminado.`, 'success');
            setIsDeleteModalOpen(false);
            setDeletingJob(null);
            fetchAllData(); // Refresh data
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
    const handleFilterChange = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handlePriorityChange = (priority: JobPriority, checked: boolean) => {
        setFilters(prev => {
            const currentPriorities = prev.priorities;
            const newPriorities = checked
                ? [...currentPriorities, priority]
                : currentPriorities.filter(p => p !== priority);
            return { ...prev, priorities: newPriorities };
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center"><BriefcaseIcon className="h-6 w-6 mr-2 text-gray-600 dark:text-slate-400"/>Gestionar Trabajos</h2>
                <Button onClick={() => handleOpenModal()}><PlusIcon className="h-5 w-5 mr-2"/>Crear Trabajo</Button>
            </CardHeader>
            <CardContent>
                 <div className="p-4 mb-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-4">
                             <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Buscar</label>
                             <Input 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por ID, descripción, sucursal..."
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
                             <Select value={filters.status} onChange={e => handleFilterChange('status', e.target.value as any)}>
                                <option value="ALL">Todos los Estados</option>
                                {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                             </Select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sucursal</label>
                             <Select value={filters.branchId} onChange={e => handleFilterChange('branchId', e.target.value)}>
                                <option value="">Todas las Sucursales</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.username}</option>)}
                             </Select>
                        </div>
                        <div className="lg:col-span-2">
                             <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fecha de Creación</label>
                             <div className="flex items-center gap-2">
                                <Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
                                <span className="text-gray-500">a</span>
                                <Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
                             </div>
                        </div>
                        <div className="lg:col-span-4">
                             <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
                             <div className="flex items-center space-x-4 pt-1">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <Checkbox checked={filters.priorities.includes(JobPriority.Urgente)} onChange={e => handlePriorityChange(JobPriority.Urgente, e.target.checked)} />
                                    <span className="dark:text-slate-200">Urgente</span>
                                </label>
                                 <label className="flex items-center space-x-2 cursor-pointer">
                                    <Checkbox checked={filters.priorities.includes(JobPriority.Repeticion)} onChange={e => handlePriorityChange(JobPriority.Repeticion, e.target.checked)} />
                                    <span className="dark:text-slate-200">Repetición</span>
                                </label>
                             </div>
                        </div>
                    </div>
                </div>

                {isLoading ? <p>Cargando trabajos...</p> : (
                <>
                    {/* Mobile View */}
                    <div className="md:hidden">
                        {jobs.length > 0 ? (
                            jobs.map(job => (
                                <JobRowCard key={job.id} job={job} onEdit={handleOpenModal} onDelete={handleOpenDeleteModal} />
                            ))
                        ) : (
                             <div className="text-center p-6 text-gray-500 dark:text-slate-400">
                                No se encontraron trabajos que coincidan con los filtros.
                            </div>
                        )}
                    </div>

                    {/* Desktop View */}
                    <div className="overflow-x-auto hidden md:block">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-slate-700">
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">#</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Descripción</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Sucursal</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Estado</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Prioridad</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.length > 0 ? jobs.map(job => (
                                    <tr key={job.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="p-3 font-mono text-gray-900 dark:text-slate-200">{job.id}</td>
                                        <td className="p-3 text-gray-800 dark:text-slate-300">{job.description}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400">{job.branch_name}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400">{job.status}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400">{job.priority}</td>
                                        <td className="p-3 text-right space-x-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(job)} title="Editar trabajo">
                                                <EditIcon className="h-5 w-5 text-gray-600 dark:text-slate-300"/>
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenDeleteModal(job)} title="Eliminar trabajo">
                                                <TrashIcon className="h-5 w-5 text-red-500"/>
                                            </Button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="text-center p-6 text-gray-500 dark:text-slate-400">
                                            No se encontraron trabajos que coincidan con los filtros.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                     <Pagination 
                        currentPage={currentPage}
                        totalPages={Math.ceil(totalJobs / PAGE_SIZE)}
                        onPageChange={setCurrentPage}
                    />
                </>
                )}
            </CardContent>

             <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingJob?.created_at ? `Editar Trabajo #${editingJob.id}` : "Crear Nuevo Trabajo"}>
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nº de Trabajo</label>
                        <Input value={editingJob?.id || ''} onChange={e => setEditingJob({...editingJob, id: e.target.value})} disabled={!!editingJob?.created_at} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descripción</label>
                        <Input value={editingJob?.description || ''} onChange={e => setEditingJob({...editingJob, description: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Sucursal</label>
                        <Select value={editingJob?.branch_id || ''} onChange={e => setEditingJob({...editingJob, branch_id: e.target.value})}>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.username}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Estado</label>
                        <Select value={editingJob?.status || ''} onChange={e => setEditingJob({...editingJob, status: e.target.value as JobStatus})}>
                            {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Prioridad</label>
                        <Select value={editingJob?.priority || ''} onChange={e => setEditingJob({...editingJob, priority: e.target.value as JobPriority})}>
                             {Object.values(JobPriority).map(p => <option key={p} value={p}>{p}</option>)}
                        </Select>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSaveJob}>Guardar Cambios</Button>
                    </div>
                </div>
            </Modal>
            
             <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Eliminación">
                 <div className="space-y-4">
                    <p className="text-gray-700 dark:text-slate-300">
                        ¿Está seguro de que desea eliminar el trabajo <strong className="text-red-600">#{deletingJob?.id}</strong>? Esta acción no se puede deshacer.
                    </p>
                     <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
                        <Button variant="danger" onClick={handleConfirmDelete}>Eliminar</Button>
                    </div>
                </div>
            </Modal>
        </Card>
    )
};

export default ManageJobs;