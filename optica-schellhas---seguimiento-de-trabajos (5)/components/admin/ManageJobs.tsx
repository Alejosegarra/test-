import React, { useState, useEffect, useCallback } from 'react';
import { useToast, useRefresh } from '../../App';
import { JobStatus, JobPriority, JobType, type User, type Job } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { Button, Input, Modal, Card, CardHeader, CardContent, Select, Checkbox } from '../common/UI';
import { BriefcaseIcon, PlusIcon, EditIcon, TrashIcon, HistoryIcon, DownloadIcon, ChevronRightIcon, WrenchIcon } from '../common/Icons';
import { Pagination } from '../common/Pagination';
import { JobHistoryModal } from '../common/JobHistoryModal';

const PAGE_SIZE_OPTIONS = [15, 30, 50];

const ResponsiveJobRow: React.FC<{ 
    job: Job, 
    onEdit: () => void, 
    onDelete: () => void, 
    onViewHistory: () => void 
}> = ({ job, onEdit, onDelete, onViewHistory }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <>
            <tr className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50" aria-expanded={isExpanded}>
                <td className="p-3 font-mono text-gray-900 dark:text-slate-200">
                    <div className="flex items-center">
                        {job.job_type === JobType.Reparacion && <WrenchIcon className="h-3.5 w-3.5 mr-2 text-gray-500" title="Reparación"/>}
                        {job.id}
                    </div>
                </td>
                <td className="p-3 text-gray-800 dark:text-slate-300 max-w-xs truncate" title={job.description}>{job.description || "Sin descripción"}</td>
                <td className="p-3 text-gray-600 dark:text-slate-400 hidden md:table-cell">{job.branch_name}</td>
                <td className="p-3 text-gray-600 dark:text-slate-400 hidden md:table-cell">{job.status}</td>
                <td className="p-3 text-gray-600 dark:text-slate-400 hidden md:table-cell">{job.priority}</td>
                <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                         <div className="hidden md:flex items-center space-x-1">
                            <Button variant="ghost" size="sm" onClick={onViewHistory} title="Ver historial">
                                <HistoryIcon className="h-5 w-5 text-gray-600 dark:text-slate-300"/>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={onEdit} title="Editar trabajo">
                                <EditIcon className="h-5 w-5 text-gray-600 dark:text-slate-300"/>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={onDelete} title="Eliminar trabajo">
                                <TrashIcon className="h-5 w-5 text-red-500"/>
                            </Button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="md:hidden" aria-controls={`details-${job.id}`}>
                             <span className="sr-only">{isExpanded ? 'Ocultar detalles' : 'Mostrar detalles'}</span>
                            <ChevronRightIcon className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="md:hidden border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50" id={`details-${job.id}`}>
                    <td colSpan={3} className="p-4">
                         <div className="space-y-3">
                            <div>
                                <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Sucursal</p>
                                <p className="text-gray-600 dark:text-slate-400">{job.branch_name}</p>
                            </div>
                             <div>
                                <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Estado</p>
                                <p className="text-gray-600 dark:text-slate-400">{job.status}</p>
                            </div>
                             <div>
                                <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Prioridad</p>
                                <p className="text-gray-600 dark:text-slate-400">{job.priority}</p>
                            </div>
                            <div className="flex justify-start space-x-1 pt-2">
                                <Button variant="secondary" size="sm" onClick={onViewHistory}>
                                    <HistoryIcon className="h-4 w-4 mr-2"/> Historial
                                </Button>
                                <Button variant="secondary" size="sm" onClick={onEdit}>
                                    <EditIcon className="h-4 w-4 mr-2"/> Editar
                                </Button>
                                <Button variant="danger" size="sm" onClick={onDelete}>
                                    <TrashIcon className="h-4 w-4 mr-2"/> Eliminar
                                </Button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
};


type ExportableJobKeys = 'id' | 'description' | 'branch_name' | 'status' | 'priority' | 'priority_message' | 'created_at' | 'updated_at' | 'history' | 'job_type';

const allExportColumns: Record<ExportableJobKeys, string> = {
    id: 'Nº de Trabajo',
    job_type: 'Tipo de Trabajo',
    description: 'Descripción',
    branch_name: 'Sucursal',
    status: 'Estado',
    priority: 'Prioridad',
    priority_message: 'Mensaje de Prioridad',
    created_at: 'Fecha de Creación',
    updated_at: 'Última Actualización',
    history: 'Historial Completo (JSON)',
};

const ManageJobs: React.FC<{ user: User }> = ({ user }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: 'ALL' as JobStatus | 'ALL',
        branchId: '',
        priorities: [] as JobPriority[],
        jobType: '' as JobType | '',
        startDate: '',
        endDate: '',
    });
    const [sortBy, setSortBy] = useState<'updated_at' | 'priority' | 'id_asc' | 'id_desc'>('updated_at');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<Partial<Job> | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingJob, setDeletingJob] = useState<Job | null>(null);
    const [viewingHistoryJob, setViewingHistoryJob] = useState<Job | null>(null);
    const { addToast } = useToast();
    const { refreshKey } = useRefresh();
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalJobs, setTotalJobs] = useState(0);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportColumns, setExportColumns] = useState<Record<ExportableJobKeys, boolean>>({
        id: true,
        job_type: true,
        description: true,
        branch_name: true,
        status: true,
        priority: true,
        priority_message: false,
        created_at: true,
        updated_at: false,
        history: false,
    });

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [jobsResponse, branchesData] = await Promise.all([
                api.apiGetJobs(user, {
                    page: currentPage,
                    pageSize: pageSize,
                    searchTerm,
                    sortBy,
                    statusFilter: filters.status,
                    branchIdFilter: filters.branchId,
                    priorityFilter: filters.priorities,
                    jobTypeFilter: filters.jobType || undefined,
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
    }, [user, addToast, currentPage, pageSize, searchTerm, filters, sortBy]);
    
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData, refreshKey]);

    useEffect(() => {
        // Reset to first page whenever filters change
        setCurrentPage(1);
    }, [searchTerm, filters, sortBy, pageSize]);

    useEffect(() => {
        const channel = supabase
            .channel('public:jobs:admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchAllData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAllData]);

    const handleOpenModal = (job: Job | null = null) => {
        setEditingJob(job ? { ...job } : { priority: JobPriority.Normal, status: JobStatus.PendingInBranch, branch_id: branches[0]?.id, job_type: JobType.Nuevo });
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
                    branch_name: branch.username,
                    job_type: jobData.job_type || JobType.Nuevo
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

    const handleConfirmExport = async () => {
        setIsExporting(true);
        addToast('Preparando el reporte...', 'success');

        try {
            const jobsToExport = await api.apiGetJobsForExport({
                searchTerm,
                sortBy,
                statusFilter: filters.status,
                branchIdFilter: filters.branchId,
                priorityFilter: filters.priorities,
                jobTypeFilter: filters.jobType || undefined,
                startDate: filters.startDate,
                endDate: filters.endDate,
            });

            if (jobsToExport.length === 0) {
                addToast('No hay trabajos para exportar con los filtros seleccionados.', 'error');
                setIsExporting(false);
                return;
            }

            const selectedColumns = (Object.keys(allExportColumns) as ExportableJobKeys[])
                .filter(key => exportColumns[key]);

            const headers = selectedColumns.map(key => allExportColumns[key]);
            
            const escapeCsvCell = (cellData: any) => {
                if (cellData === null || cellData === undefined) return '';
                let cell = String(cellData);
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            };

            const csvRows = [
                headers.join(','),
                ...jobsToExport.map(job => {
                    return selectedColumns.map(key => {
                        let value = job[key as keyof Job];
                        if (key === 'created_at' || key === 'updated_at') {
                            value = new Date(value as string).toLocaleString('es-ES');
                        }
                        if (key === 'history') {
                            value = JSON.stringify(value);
                        }
                        return escapeCsvCell(value);
                    }).join(',');
                })
            ];
            
            const csvString = csvRows.join('\n');
            const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
            
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            const date = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `Reporte-Trabajos-${date}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            addToast('Reporte descargado exitosamente.', 'success');
            setIsExportModalOpen(false);

        } catch (error) {
            console.error("Failed to export jobs:", error);
            addToast('Ocurrió un error al exportar los trabajos.', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <JobHistoryModal job={viewingHistoryJob} onClose={() => setViewingHistoryJob(null)} />
            <Card>
                <CardHeader className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center"><BriefcaseIcon className="h-6 w-6 mr-2 text-gray-600 dark:text-slate-400"/>Gestionar Trabajos</h2>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setIsExportModalOpen(true)} variant="secondary">
                            <DownloadIcon className="h-5 w-5 mr-2"/>Exportar a CSV
                        </Button>
                        <Button onClick={() => handleOpenModal()}><PlusIcon className="h-5 w-5 mr-2"/>Crear Trabajo</Button>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="p-4 mb-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-5">
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo de Trabajo</label>
                                <Select value={filters.jobType} onChange={e => handleFilterChange('jobType', e.target.value as JobType)}>
                                    <option value="">Todos los Tipos</option>
                                    <option value={JobType.Nuevo}>Trabajos Nuevos</option>
                                    <option value={JobType.Reparacion}>Reparaciones</option>
                                </Select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Ordenar por</label>
                                <Select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                                    <option value="updated_at">Más Reciente</option>
                                    <option value="priority">Prioridad</option>
                                    <option value="id_asc">Nº Trabajo (Asc)</option>
                                    <option value="id_desc">Nº Trabajo (Desc)</option>
                                </Select>
                            </div>
                            <div className="lg:col-span-2">
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
                            <div className="lg:col-span-3">
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b dark:border-slate-700">
                                        <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">#</th>
                                        <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Descripción</th>
                                        <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden md:table-cell">Sucursal</th>
                                        <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden md:table-cell">Estado</th>
                                        <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden md:table-cell">Prioridad</th>
                                        <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.length > 0 ? jobs.map(job => (
                                        <ResponsiveJobRow 
                                            key={job.id} 
                                            job={job} 
                                            onEdit={() => handleOpenModal(job)} 
                                            onDelete={() => handleOpenDeleteModal(job)} 
                                            onViewHistory={() => setViewingHistoryJob(job)} 
                                        />
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
                            totalPages={Math.ceil(totalJobs / pageSize)}
                            onPageChange={setCurrentPage}
                            totalItems={totalJobs}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Tipo de Trabajo</label>
                            <Select value={editingJob?.job_type || ''} onChange={e => setEditingJob({...editingJob, job_type: e.target.value as JobType})}>
                                {Object.values(JobType).map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
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

                <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Opciones de Exportación a CSV">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-slate-400">Seleccione las columnas que desea incluir en el reporte. Los filtros actuales serán aplicados.</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto p-2 border rounded-md dark:border-slate-600">
                            {Object.entries(allExportColumns).map(([key, label]) => (
                                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                    <Checkbox
                                        checked={exportColumns[key as ExportableJobKeys]}
                                        onChange={(e) => {
                                            setExportColumns(prev => ({...prev, [key]: e.target.checked}))
                                        }}
                                    />
                                    <span className="text-sm dark:text-slate-200">{label}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button variant="secondary" onClick={() => setIsExportModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleConfirmExport} disabled={isExporting}>
                                {isExporting ? 'Exportando...' : 'Descargar Reporte'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            </Card>
        </>
    )
};

export default ManageJobs;