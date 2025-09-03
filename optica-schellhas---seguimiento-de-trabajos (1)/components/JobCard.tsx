import React, { useState, useMemo } from 'react';
import type { Job, User } from '../types';
import { Role, JobStatus, JobPriority } from '../types';
import { Card, CardContent, Button, Modal, Input, Checkbox, Select } from './common/UI';
import { AlertTriangleIcon, BranchIcon, CheckCircleIcon, SendIcon, TruckIcon, CheckIcon, RepeatIcon } from './common/Icons';

type JobCardProps = {
  job: Job;
  user: User;
  onUpdate: () => void;
  onUpdatePriority: (jobId: string, priority: JobPriority, message: string) => Promise<void>;
  onViewHistory: (job: Job) => void;
  isSelected: boolean;
  onSelect: (jobId: string, selected: boolean) => void;
};

const statusConfig = {
    [JobStatus.PendingInBranch]: { text: 'Pendiente en Sucursal', color: 'bg-gray-500', icon: null },
    [JobStatus.SentToLab]: { text: 'Enviado a Laboratorio', color: 'bg-blue-500', icon: <SendIcon className="h-4 w-4 mr-1"/> },
    [JobStatus.ReceivedByLab]: { text: 'Recibido en Laboratorio', color: 'bg-indigo-500', icon: <CheckIcon className="h-4 w-4 mr-1"/> },
    [JobStatus.Completed]: { text: 'Terminado', color: 'bg-green-500', icon: <CheckCircleIcon className="h-4 w-4 mr-1"/> },
    [JobStatus.SentToBranch]: { text: 'Enviado a Sucursal', color: 'bg-purple-500', icon: <TruckIcon className="h-4 w-4 mr-1"/> },
};

const priorityConfig = {
    [JobPriority.Normal]: { text: 'Normal', color: 'text-gray-400 dark:text-slate-500', icon: null },
    [JobPriority.Urgente]: { text: 'Urgente', color: 'text-yellow-500', icon: <AlertTriangleIcon className="h-5 w-5" /> },
    [JobPriority.Repeticion]: { text: 'Repetición', color: 'text-orange-500', icon: <RepeatIcon className="h-5 w-5" /> },
}

const JobCard: React.FC<JobCardProps> = ({ job, user, onUpdate, onUpdatePriority, onViewHistory, isSelected, onSelect }) => {
    const [isPriorityModalOpen, setPriorityModalOpen] = useState(false);
    const [priorityMessage, setPriorityMessage] = useState(job.priority_message);
    const [selectedPriority, setSelectedPriority] = useState<JobPriority>(job.priority);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePrioritySubmit = async () => {
        setIsSubmitting(true);
        await onUpdatePriority(job.id, selectedPriority, priorityMessage);
        setIsSubmitting(false);
        setPriorityModalOpen(false);
    };

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent modal from opening if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button, input, a')) {
            return;
        }
        onViewHistory(job);
    }
    
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

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(job.id, !isSelected);
    }


    const renderActions = () => {
        if (user.role === Role.Branch) {
            if (job.status === JobStatus.PendingInBranch) {
                return <Button size="sm" variant="primary" onClick={handleActionClick}><SendIcon className="h-4 w-4 mr-2"/> Enviar a Laboratorio</Button>;
            }
        }
        if (user.role === Role.Lab) {
            if (job.status === JobStatus.SentToLab) {
                return <Button size="sm" variant="primary" onClick={handleActionClick}><CheckIcon className="h-4 w-4 mr-2"/> Marcar como Recibido</Button>;
            }
            if (job.status === JobStatus.ReceivedByLab) {
                return <Button size="sm" variant="primary" onClick={handleActionClick}><CheckCircleIcon className="h-4 w-4 mr-2"/> Marcar como Terminado</Button>;
            }
            if (job.status === JobStatus.Completed) {
                return <Button size="sm" variant="primary" onClick={handleActionClick}><TruckIcon className="h-4 w-4 mr-2"/> Enviar a Sucursal</Button>;
            }
        }
        return null;
    }

    const { text: statusText, color: statusColor, icon: statusIcon } = statusConfig[job.status];
    const { color: priorityColor, icon: priorityIcon } = priorityConfig[job.priority];

    const priorityCardStyles = useMemo(() => {
        if (job.priority === JobPriority.Urgente) {
            return 'border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/20';
        }
        if (job.priority === JobPriority.Repeticion) {
            return 'border-2 border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-900/20';
        }
        return '';
    }, [job.priority]);

    return (
        <>
            <Card 
                className={`hover:shadow-lg transition-shadow duration-300 cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''} ${priorityCardStyles}`}
                onClick={handleCardClick}
            >
                <CardContent>
                    <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                            <div onClick={handleCheckboxClick} className="pt-1">
                                <Checkbox checked={isSelected} readOnly />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Trabajo #{job.id}</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400">{job.description || 'Sin descripción'}</p>
                            </div>
                        </div>
                        <div className={`flex items-center text-xs font-bold text-white px-2 py-1 rounded-full ${statusColor}`}>
                            {statusIcon}
                            {statusText}
                        </div>
                    </div>

                    <div className="mt-4 flex justify-between items-end">
                       <div>
                            <div className="flex items-center text-sm text-gray-600 dark:text-slate-300">
                                <BranchIcon className="h-4 w-4 mr-2 text-gray-400 dark:text-slate-500"/>
                                <span>{job.branch_name}</span>
                            </div>
                             <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                Última act.: {new Date(job.updated_at).toLocaleString()}
                            </p>
                       </div>
                        
                        <div className="flex items-center space-x-2">
                             <Button variant="ghost" size="sm" onClick={handlePriorityClick} aria-label="Gestionar prioridad">
                                <span className={job.priority !== JobPriority.Normal ? `${priorityColor} animate-pulse` : priorityColor}>
                                    {priorityIcon || <AlertTriangleIcon className="h-5 w-5" />}
                                </span>
                            </Button>
                            {renderActions()}
                        </div>
                    </div>
                     {job.priority !== JobPriority.Normal && job.priority_message && (
                        <div className={`mt-3 p-3 ${job.priority === JobPriority.Urgente ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-500/30' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-500/30'} rounded-md`}>
                            <div className="flex items-start">
                                <span className={`${priorityColor} mr-2 flex-shrink-0`}>{priorityIcon}</span>
                                <p className={`text-sm ${job.priority === JobPriority.Urgente ? 'text-yellow-800 dark:text-yellow-300' : 'text-orange-800 dark:text-orange-300'}`}>{job.priority_message}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

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
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                       Este mensaje será visible para el laboratorio y la sucursal.
                    </p>
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

export default JobCard;