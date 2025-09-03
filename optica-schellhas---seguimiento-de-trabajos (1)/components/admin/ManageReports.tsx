import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../App';
import { JobStatus, JobPriority, type User, type Job } from '../../types';
import * as api from '../../services/api';
import { Button, Input, Card, CardHeader, CardContent, Select } from '../common/UI';

// FIX: Destructure the 'user' prop from the component's arguments.
const ManageReports: React.FC<{ user: User }> = ({ user }) => {
    const [reportData, setReportData] = useState<Job[]>([]);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        branchId: '',
        status: '',
        priority: '',
    });

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const branchesData = await api.apiGetAllBranches();
                setBranches(branchesData);
            } catch (error) {
                addToast('Error al cargar sucursales.', 'error');
            }
        };
        fetchBranches();
    }, [addToast]);

    const handleFilterChange = (key: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleGenerateReport = useCallback(async () => {
        setIsLoading(true);
        setReportData([]);
        try {
            const response = await api.apiGetJobs(user, {
                disablePagination: true,
                startDate: filters.startDate,
                endDate: filters.endDate,
                branchIdFilter: filters.branchId,
                statusFilter: filters.status as JobStatus | '',
                priorityFilter: filters.priority ? [filters.priority as JobPriority] : [],
            });
            setReportData(response.jobs);
            addToast(`${response.count} registros encontrados.`, 'success');
        } catch (error) {
            addToast('Error al generar el reporte.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, filters, addToast]);

    const handleExportCSV = () => {
        if (reportData.length === 0) {
            addToast('No hay datos para exportar.', 'error');
            return;
        }

        const headers = ['ID Trabajo', 'Descripción', 'Sucursal', 'Estado', 'Prioridad', 'Fecha Creación', 'Última Actualización'];
        const rows = reportData.map(job => [
            job.id,
            `"${job.description.replace(/"/g, '""')}"`,
            job.branch_name,
            job.status,
            job.priority,
            new Date(job.created_at).toLocaleString(),
            new Date(job.updated_at).toLocaleString(),
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_trabajos_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader>
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Generador de Reportes</h2>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 p-4 border dark:border-slate-700 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Rango de Fechas</label>
                            <div className="flex items-center gap-2">
                                <Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
                                <span className="text-gray-500">a</span>
                                <Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sucursal</label>
                            <Select value={filters.branchId} onChange={e => handleFilterChange('branchId', e.target.value)}>
                                <option value="">Todas</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.username}</option>)}
                            </Select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Estado</label>
                            <Select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}>
                                <option value="">Todos</option>
                                {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
                            <Select value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)}>
                                <option value="">Todas</option>
                                {Object.values(JobPriority).map(p => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="primary" onClick={handleGenerateReport} disabled={isLoading}>
                            {isLoading ? "Generando..." : "Generar Reporte"}
                        </Button>
                        <Button variant="secondary" onClick={handleExportCSV} disabled={reportData.length === 0}>
                            Exportar a CSV
                        </Button>
                    </div>
                </div>

                <div className="mt-6">
                    <h3 className="font-semibold mb-2">Resultados ({reportData.length})</h3>
                    <div className="overflow-x-auto max-h-[60vh] border dark:border-slate-700 rounded-lg">
                         <table className="w-full text-left">
                            <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700">
                                <tr className="border-b dark:border-slate-600">
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300"># Trabajo</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Sucursal</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Estado</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Creado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center p-6 text-gray-500 dark:text-slate-400">Cargando...</td></tr>
                                ) : reportData.length > 0 ? reportData.map(job => (
                                    <tr key={job.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="p-3 font-mono text-gray-900 dark:text-slate-200">{job.id}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400">{job.branch_name}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400">{job.status}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400 text-sm">{new Date(job.created_at).toLocaleDateString()}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="text-center p-6 text-gray-500 dark:text-slate-400">
                                            No se encontraron resultados. Ajuste los filtros y genere un nuevo reporte.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ManageReports;