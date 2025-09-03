import React from 'react';
import type { Job } from '../../types';
import { Modal } from './UI';
import { CheckCircleIcon } from './Icons';

export const JobHistoryModal: React.FC<{ job: Job | null; onClose: () => void }> = ({ job, onClose }) => {
    if (!job) return null;

    return (
        <Modal isOpen={!!job} onClose={onClose} title={`Historial del Trabajo #${job.id}`} size="lg">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="text-sm dark:text-slate-300">
                    <p><strong>Descripción:</strong> {job.description || 'N/A'}</p>
                    <p><strong>Sucursal:</strong> {job.branch_name}</p>
                    <p><strong>Creado:</strong> {new Date(job.created_at).toLocaleString()}</p>
                </div>
                <ul className="space-y-3">
                    {[...(job.history || [])].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, index) => (
                        <li key={index} className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                               <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-slate-200">{entry.status}</p>
                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                    Por <span className="font-medium">{entry.updatedBy}</span> el {new Date(entry.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
};