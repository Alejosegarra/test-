import React, { useState, useEffect, useCallback } from 'react';
import { useRefresh, useToast } from '../../App';
import * as api from '../../services/api';
import type { Job } from '../../types';
import { Card, CardContent } from '../common/UI';
import { WrenchIcon, PackageIcon } from '../common/Icons';

const RepairsWaitingView: React.FC = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { refreshKey } = useRefresh();
    const { addToast } = useToast();

    const fetchJobs = useCallback(async () => {
        setIsLoading(true);
        try {
            const waitingJobs = await api.apiGetRepairsWaitingForParts();
            setJobs(waitingJobs);
        } catch (error) {
            addToast('Error al cargar las reparaciones en espera.', 'error');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs, refreshKey]);

    return (
        <Card>
            <CardContent>
                {isLoading ? (
                    <div className="text-center p-10">Cargando reparaciones en espera...</div>
                ) : jobs.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-slate-700">
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300"># Trabajo</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Sucursal</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Descripción</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Estado del Repuesto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(job => (
                                    <tr key={job.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="p-3 font-mono text-gray-900 dark:text-slate-200">
                                            <div className="flex items-center">
                                                <WrenchIcon className="h-4 w-4 mr-2 text-gray-500" />
                                                {job.id}
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-800 dark:text-slate-300">{job.branch_name}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400 max-w-xs truncate" title={job.description}>{job.description}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400">
                                            <div className="flex items-center font-medium">
                                                <PackageIcon className="h-4 w-4 mr-2" />
                                                {job.linked_spare_part?.status || 'Desconocido'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500 dark:text-slate-400">No hay reparaciones esperando repuestos en este momento.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default RepairsWaitingView;
