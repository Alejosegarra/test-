import React, { useState, useMemo } from 'react';
import type { Job, User } from '../../types';
import { Role, JobStatus, JobPriority, JobType, SparePartOrderStatus } from '../../types';
import { Button, Modal, Input, Checkbox, Select } from './UI';
import { AlertTriangleIcon, CheckCircleIcon, SendIcon, TruckIcon, CheckIcon, RepeatIcon, ChevronRightIcon, HistoryIcon, WrenchIcon, PackageIcon } from './Icons';
import { statusConfig, priorityConfig } from '../jobConfig';

type JobRowProps = {
  job: Job;
  user: User;
  onUpdate: () => void;
  onUpdatePriority: (jobId: string, priority: JobPriority, message: string) => Promise<void>;
  onViewHistory: (job: Job) => void;
  selectable?: boolean;
  isSelected: boolean;
  onSelect: (jobId: string, selected: boolean) => void;
};

export const JobRow: React.FC<JobRowProps> = ({ job, user, onUpdate, onUpdatePriority, onViewHistory, isSelected, onSelect, selectable = true }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPriorityModalOpen, setPriorityModalOpen] = useState(false);
    const [priorityMessage, setPriorityMessage] = useState(job.priority_message);
    const [selectedPriority, setSelectedPriority] = useState<JobPriority>(job.priority);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isWaitingForPart = useMemo(() => 
        job.job_type === JobType.Reparacion &&
        job.linked_spare_part &&
        job.linked_spare_part.status !== SparePartOrderStatus.ReceivedByBranch,
    [job]);

    const handlePrioritySubmit = async () => {
        setIsSubmitting(true);
        await onUpdatePriority(job.id, selectedPriority, priorityMessage);
        setIsSubmitting(false);
        setPriorityModalOpen(false);
    };

    const handleActionClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdate();
    }
    
    const handlePriorityClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedPriority(job.priority);
        setPriorityMessage(job.priority_message);
        setPriorityModalOpen(true);
    }
    
    const renderActions = () => {
        if (user.role === Role.Branch) {
            if (job.status === JobStatus.PendingInBranch) {
                if (isWaitingForPart) return null;
                return <Button size="sm" variant="secondary" onClick={handleActionClick}><SendIcon className="h-4 w-4 mr-2"/>Enviar</Button>;
            }
            if (job.status === JobStatus.SentToBranch) return <Button size="sm" variant="secondary" onClick={handleActionClick}><CheckCircleIcon className="h-4 w-4 mr-2"/>Recibido</Button>;
        }
        if (user.role === Role.Lab) {
            if (job.status === JobStatus.SentToLab) return <Button size="sm" variant="secondary" onClick={handleActionClick}><CheckIcon className="h-4 w-4 mr-2"/>Recibido</Button>;
            if (job.status === JobStatus.ReceivedByLab) return <Button size="sm" variant="secondary" onClick={handleActionClick}><CheckCircleIcon className="h-4 w-4 mr-2"/>Terminado</Button>;
            if (job.status === JobStatus.Completed) return <Button size="sm" variant="secondary" onClick={handleActionClick}><TruckIcon className="h-4 w-4 mr-2"/>Enviar</Button>;
        }
        return null;
    }

    const { text: statusText, color: statusColor, icon: statusIcon } = statusConfig[job.status];
    const { color: priorityColor, icon: priorityIcon } = priorityConfig[job.priority];

    const priorityRowStyles = useMemo(() => {
        if (job.priority === JobPriority.Urgente) return 'bg-yellow-50/50 dark:bg-yellow-900/10';
        if (job.priority === JobPriority.Repeticion) return 'bg-orange-50/50 dark:bg-orange-900/10';
        return '';
    }, [job.priority]);

    const colSpan = user.role === Role.Lab ? 9 : 7;

    return (
        <>
            <tr 
                className={`border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : priorityRowStyles}`} 
                onClick={() => onViewHistory(job)}
                aria-expanded={isExpanded}
            >
                <td className="p-3 w-12" onClick={e => e.stopPropagation()}>
                    {selectable && <Checkbox checked={isSelected} onChange={(e) => onSelect(job.id, e.target.checked)} />}
                </td>
                <td className="p-3 font-mono text-gray-900 dark:text-slate-200">
                    <div className="flex items-center">
                        {job.job_type === JobType.Reparacion && <WrenchIcon className="h-3 w-3 mr-1.5 text-gray-500" title="Reparación"/>}
                        {job.id}
                    </div>
                    {isWaitingForPart && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center mt-1">
                            <PackageIcon className="h-3 w-3 mr-1" />
                            Esperando repuesto...
                        </div>
                    )}
                </td>
                {/* Main Action Button Cell for Lab Users */}
                {user.role === Role.Lab && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                        {renderActions()}
                    </td>
                )}
                {user.role === Role.Lab && <td className="p-3 font-medium text-gray-700 dark:text-slate-300 hidden sm:table-cell">{job.branch_name}</td>}
                <td className="p-3 text-gray-800 dark:text-slate-300 max-w-[150px] sm:max-w-xs truncate" title={job.description}>{job.description || "Sin descripción"}</td>
                <td className="p-3 text-gray-600 dark:text-slate-400 hidden sm:table-cell">
                    <span className={`inline-flex items-center text-xs font-bold text-white px-2 py-1 rounded-full ${statusColor}`}>{statusIcon}{statusText}</span>
                </td>
                <td className="p-3 hidden md:table-cell">
                    <span className={`flex justify-center ${priorityColor}`}>{priorityIcon}</span>
                </td>
                <td className="p-3 text-gray-500 dark:text-slate-400 text-xs hidden lg:table-cell">{new Date(job.updated_at).toLocaleString('es-ES')}</td>
                <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-1">
                        <Button variant="ghost" size="sm" onClick={handlePriorityClick} className="!p-2">
                             <span className={job.priority !== JobPriority.Normal ? `${priorityColor} animate-pulse` : priorityColor}>
                                {priorityIcon || <AlertTriangleIcon className="h-5 w-5" />}
                            </span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onViewHistory(job)} className="!p-2 hidden md:inline-flex" title="Ver historial">
                            <HistoryIcon className="h-5 w-5" />
                        </Button>
                        {/* Main Action Button for Branch Users ONLY */}
                        {user.role !== Role.Lab && (
                            <div className="hidden md:inline-block">{renderActions()}</div>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="md:hidden !p-2" aria-controls={`details-${job.id}`}>
                            <span className="sr-only">{isExpanded ? 'Ocultar detalles' : 'Mostrar detalles'}</span>
                            <ChevronRightIcon className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="md:hidden border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50" id={`details-${job.id}`}>
                    <td colSpan={colSpan} className="p-4">
                         <div className="space-y-3">
                            {user.role === Role.Branch && (
                                <div>
                                    <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Sucursal</p>
                                    <p className="text-gray-600 dark:text-slate-400">{job.branch_name}</p>
                                </div>
                            )}
                             {isWaitingForPart && (
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                                    <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">Esperando Repuesto</p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300">Estado del repuesto: {job.linked_spare_part?.status}</p>
                                </div>
                            )}
                            <div className="sm:hidden">
                                <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Estado</p>
                                <p><span className={`inline-flex items-center text-xs font-bold text-white px-2 py-1 rounded-full ${statusColor}`}>{statusIcon}{statusText}</span></p>
                            </div>
                            <div className="md:hidden">
                                <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Prioridad</p>
                                <p className={`flex items-center gap-2 ${priorityColor}`}>{priorityIcon} {job.priority}</p>
                            </div>
                             <div className="lg:hidden">
                                <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Última Actualización</p>
                                <p className="text-gray-600 dark:text-slate-400 text-sm">{new Date(job.updated_at).toLocaleString('es-ES')}</p>
                            </div>
                            {job.priority !== JobPriority.Normal && job.priority_message && (
                                <div>
                                    <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">Mensaje de Prioridad</p>
                                    <p className={`text-sm ${job.priority === JobPriority.Urgente ? 'text-yellow-800 dark:text-yellow-300' : 'text-orange-800 dark:text-orange-300'}`}>{job.priority_message}</p>
                                </div>
                            )}
                            <div className="flex justify-start items-center gap-1 pt-2">
                                {renderActions()}
                                <Button variant="secondary" size="sm" onClick={() => onViewHistory(job)}>
                                    <HistoryIcon className="h-4 w-4 mr-2"/> Historial
                                </Button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
             <Modal isOpen={isPriorityModalOpen} onClose={() => setPriorityModalOpen(false)} title={`Gestionar Prioridad #${job.id}`}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Prioridad</label>
                        <Select value={selectedPriority} onChange={e => setSelectedPriority(e.target.value as JobPriority)}>
                            <option value={JobPriority.Normal}>Normal</option>
                            <option value={JobPriority.Urgente}>Urgente</option>
                            <option value={JobPriority.Repeticion}>Repetición</option>
                        </Select>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Mensaje de Prioridad (Opcional)</label>
                        <Input 
                            value={priorityMessage} 
                            onChange={(e) => setPriorityMessage(e.target.value)} 
                            placeholder="Ej: Cliente necesita urgente, etc."
                        />
                    </div>
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setPriorityModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handlePrioritySubmit} disabled={isSubmitting}>
                            {isSubmitting ? "Guardando..." : "Guardar Prioridad"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};