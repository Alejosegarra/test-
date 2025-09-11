
import { Role, JobStatus, JobPriority, type User, type Job, type Announcement, type JobHistoryEntry } from '../types';
import { supabase } from './supabaseClient';

// --- Auth ---
export const apiGetLoginUsers = async (): Promise<Pick<User, 'id' | 'username'>[]> => {
    const { data, error } = await supabase.from('users').select('id, username');
    if (error) throw error;
    return data;
};

export const apiLogin = async (username: string, password: string): Promise<User | null> => {
    // ADVERTENCIA DE SEGURIDAD: Este método es inseguro y solo para fines de demostración.
    // En un entorno de producción, utiliza Supabase Auth.
    const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('username', username)
        .eq('password', password) // Comparación en texto plano (NO SEGURO)
        .single();
    
    // El código de error 'PGRST116' significa que no se encontró ninguna fila, lo cual es un fallo de login esperado.
    if (error && error.code !== 'PGRST116') throw error;
    
    return data as User | null;
};

// --- Jobs ---
export const apiGetJobs = async (
    user: User,
    options: {
        page?: number;
        pageSize?: number;
        searchTerm?: string;
        sortBy?: 'updated_at' | 'priority' | 'id_asc' | 'id_desc';
        statusFilter?: JobStatus | JobStatus[] | 'HISTORY' | 'ALL';
        priorityFilter?: JobPriority[];
        startDate?: string;
        endDate?: string;
        branchIdFilter?: string;
    } = {}
): Promise<{ jobs: Job[]; count: number }> => {
    const { page = 1, pageSize = 15, searchTerm, sortBy = 'updated_at', statusFilter, priorityFilter, startDate, endDate, branchIdFilter } = options;
    let query = supabase.from('jobs').select('*', { count: 'exact' });

    if (user.role === Role.Branch) {
        query = query.eq('branch_id', user.id);
    }

    if (branchIdFilter) {
        query = query.eq('branch_id', branchIdFilter);
    }

    if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'HISTORY') {
            if (user.role === Role.Lab) {
                // Para el laboratorio, el historial son los trabajos que la sucursal ya confirmó como recibidos.
                query = query.eq('status', JobStatus.ReceivedByBranch);
            } else {
                // Para sucursales, el historial son los trabajos que ya recibieron de vuelta.
                query = query.eq('status', JobStatus.ReceivedByBranch);
            }
        } else if (Array.isArray(statusFilter)) {
            query = query.in('status', statusFilter);
        } else {
            query = query.eq('status', statusFilter as JobStatus);
        }
    }

    if (priorityFilter && priorityFilter.length > 0) {
        query = query.in('priority', priorityFilter);
    }
    
    if (startDate) {
        query = query.gte('created_at', startDate);
    }

    if (endDate) {
        // Ensure the end date is inclusive for the entire day.
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
    }

    if (searchTerm) {
        query = query.or(`id.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,branch_name.ilike.%${searchTerm}%`);
    }

    if (sortBy === 'priority') {
        query = query.order('priority', { ascending: false }).order('updated_at', { ascending: false });
    } else if (sortBy === 'id_asc') {
        query = query.order('id', { ascending: true });
    } else if (sortBy === 'id_desc') {
        query = query.order('id', { ascending: false });
    } else {
        query = query.order('updated_at', { ascending: false });
    }
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;
    return { jobs: (data as Job[]) || [], count: count ?? 0 };
};


export const apiCreateJob = async (jobData: { id: string; description: string; branch_id: string; branch_name: string }): Promise<Job> => {
    const now = new Date().toISOString();
    const newJob: Omit<Job, 'created_at' | 'updated_at'> = {
        ...jobData,
        status: JobStatus.PendingInBranch,
        priority: JobPriority.Normal,
        priority_message: '',
        history: [{
            timestamp: now,
            status: JobStatus.PendingInBranch,
            updatedBy: jobData.branch_name,
        }]
    };

    const { data, error } = await supabase
        .from('jobs')
        .insert(newJob)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') { // Error de violación de clave primaria (id duplicado)
            throw new Error('El número de trabajo ya existe.');
        }
        throw error;
    }
    return data as Job;
};

export const apiUpdateJob = async (jobId: string, updates: Partial<Omit<Job, 'id' | 'history'>>, updatedBy: User): Promise<Job> => {
    const { data: currentJob, error: fetchError } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (fetchError) throw fetchError;
    if (!currentJob) throw new Error("Trabajo no encontrado");

    const now = new Date().toISOString();
    const newHistory = [...currentJob.history];

    if (updates.status && updates.status !== currentJob.status) {
        newHistory.push({ timestamp: now, status: updates.status, updatedBy: updatedBy.username });
    }
    
    if (updates.priority && updates.priority !== currentJob.priority) {
        newHistory.push({ timestamp: now, status: `PRIORIDAD CAMBIADA A ${updates.priority}`, updatedBy: updatedBy.username });
    }

    if (updates.description && updates.description !== currentJob.description) {
        newHistory.push({ timestamp: now, status: 'Descripción actualizada', updatedBy: updatedBy.username });
    }

    if (updates.branch_id && updates.branch_id !== currentJob.branch_id) {
        newHistory.push({ timestamp: now, status: `Transferido a sucursal ${updates.branch_name || 'desconocida'}`, updatedBy: updatedBy.username });
    }

    const { data, error } = await supabase
        .from('jobs')
        .update({ ...updates, updated_at: now, history: newHistory })
        .eq('id', jobId)
        .select()
        .single();
    
    if (error) throw error;
    return data as Job;
};

export const apiDeleteJob = async (jobId: string): Promise<{ success: true }> => {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) throw error;
    return { success: true };
};

export const apiGetJobsForExport = async (
    options: {
        searchTerm?: string;
        sortBy?: 'updated_at' | 'priority' | 'id_asc' | 'id_desc';
        statusFilter?: JobStatus | 'ALL';
        priorityFilter?: JobPriority[];
        startDate?: string;
        endDate?: string;
        branchIdFilter?: string;
    } = {}
): Promise<Job[]> => {
    const { searchTerm, sortBy = 'updated_at', statusFilter, priorityFilter, startDate, endDate, branchIdFilter } = options;
    let query = supabase.from('jobs').select('*');

    if (branchIdFilter) {
        query = query.eq('branch_id', branchIdFilter);
    }

    if (statusFilter && statusFilter !== 'ALL') {
         query = query.eq('status', statusFilter as JobStatus);
    }

    if (priorityFilter && priorityFilter.length > 0) {
        query = query.in('priority', priorityFilter);
    }
    
    if (startDate) {
        query = query.gte('created_at', startDate);
    }

    if (endDate) {
        // Ensure the end date is inclusive for the entire day.
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
    }

    if (searchTerm) {
        query = query.or(`id.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,branch_name.ilike.%${searchTerm}%`);
    }

    if (sortBy === 'priority') {
        query = query.order('priority', { ascending: false }).order('updated_at', { ascending: false });
    } else if (sortBy === 'id_asc') {
        query = query.order('id', { ascending: true });
    } else if (sortBy === 'id_desc') {
        query = query.order('id', { ascending: false });
    } else {
        query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as Job[]) || [];
};


export const apiBulkUpdateJobs = async (jobIds: string[], status: JobStatus, updatedBy: User): Promise<Job[]> => {
    const { data: currentJobs, error: fetchError } = await supabase.from('jobs').select('id, history').in('id', jobIds);
    if(fetchError) throw fetchError;
    
    const now = new Date().toISOString();
    const jobsToUpdate = currentJobs.map(job => ({
        ...job,
        status,
        updated_at: now,
        history: [...job.history, { timestamp: now, status, updatedBy: updatedBy.username }]
    }));

    const { data, error } = await supabase.from('jobs').upsert(jobsToUpdate).select();

    if (error) throw error;
    return data as Job[];
};

// --- Admin: Users ---
export const apiGetUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('id, username, role');
    if (error) throw error;
    return (data as User[]) || [];
};

export const apiGetAllBranches = async (): Promise<Pick<User, 'id' | 'username'>[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('role', Role.Branch);
    if (error) throw error;
    return data || [];
};

type StatsResult = {
    totalJobs: number;
    jobsByBranch: Record<string, number>;
    jobsByPriority: Record<JobPriority, number>;
    monthlyProgress: { month: string; total: number; byBranch: Record<string, number> }[];
    averageCycleTime: number; // in hours
    repetitionRate: number; // as a percentage
    mostActiveBranch: string;
    cycleTimeByBranch: Record<string, number>; // in hours
    jobsByStatus: Record<string, number>;
};

// FIX: Changed the type of 'allJobs' to match the data being queried, which only selects a subset of Job properties.
const processJobsToStats = (allJobs: Pick<Job, 'branch_name' | 'priority' | 'created_at' | 'status' | 'history'>[] | null): StatsResult => {
     if (!allJobs || allJobs.length === 0) {
        return {
            totalJobs: 0,
            jobsByBranch: {},
            jobsByPriority: {
                [JobPriority.Normal]: 0,
                [JobPriority.Urgente]: 0,
                [JobPriority.Repeticion]: 0,
            },
            monthlyProgress: [],
            averageCycleTime: 0,
            repetitionRate: 0,
            mostActiveBranch: 'N/A',
            cycleTimeByBranch: {},
            jobsByStatus: {},
        };
    }

    const jobsByBranch = allJobs.reduce((acc, job) => {
        if(job.branch_name) acc[job.branch_name] = (acc[job.branch_name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const jobsByPriority = allJobs.reduce((acc, job) => {
        acc[job.priority] = (acc[job.priority] || 0) + 1;
        return acc;
    }, { [JobPriority.Normal]: 0, [JobPriority.Urgente]: 0, [JobPriority.Repeticion]: 0 } as Record<JobPriority, number>);

    const monthlyData: Record<string, { total: number; byBranch: Record<string, number> }> = {};
    
    allJobs.forEach(job => {
        const date = new Date(job.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, byBranch: {} };
        }
        
        monthlyData[monthKey].total++;
        if (job.branch_name) {
             monthlyData[monthKey].byBranch[job.branch_name] = (monthlyData[monthKey].byBranch[job.branch_name] || 0) + 1;
        }
    });
    
    const monthlyProgress = Object.entries(monthlyData)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));
        
    const mostActiveBranch = Object.entries(jobsByBranch).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0])[0] || 'N/A';
    
    const repetitionJobsCount = allJobs.filter(j => j.priority === JobPriority.Repeticion).length;
    const repetitionRate = allJobs.length > 0 ? (repetitionJobsCount / allJobs.length) * 100 : 0;

    const jobsByStatus = allJobs.reduce((acc, job) => {
        if (job.status) acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    let totalCycleTime = 0;
    let completedJobsCount = 0;
    const cycleTimeDataByBranch: Record<string, { totalHours: number; count: number }> = {};

    allJobs.forEach(job => {
        const sentToLabEntry = job.history.find(h => h.status === JobStatus.SentToLab);
        const completedEntry = job.history.find(h => h.status === JobStatus.Completed);

        if (sentToLabEntry && completedEntry) {
            const startTime = new Date(sentToLabEntry.timestamp).getTime();
            const endTime = new Date(completedEntry.timestamp).getTime();
            if (endTime > startTime) {
                const cycleHours = (endTime - startTime) / (1000 * 60 * 60);
                totalCycleTime += cycleHours;
                completedJobsCount++;

                if (job.branch_name) {
                    if (!cycleTimeDataByBranch[job.branch_name]) {
                        cycleTimeDataByBranch[job.branch_name] = { totalHours: 0, count: 0 };
                    }
                    cycleTimeDataByBranch[job.branch_name].totalHours += cycleHours;
                    cycleTimeDataByBranch[job.branch_name].count++;
                }
            }
        }
    });

    const averageCycleTime = completedJobsCount > 0 ? totalCycleTime / completedJobsCount : 0;
    
    const cycleTimeByBranch = Object.entries(cycleTimeDataByBranch).reduce((acc, [branch, data]) => {
        acc[branch] = data.count > 0 ? data.totalHours / data.count : 0;
        return acc;
    }, {} as Record<string, number>);

    return {
        totalJobs: allJobs.length,
        jobsByBranch,
        jobsByPriority,
        monthlyProgress,
        averageCycleTime,
        repetitionRate,
        mostActiveBranch,
        cycleTimeByBranch,
        jobsByStatus,
    };
};

export const apiGetStats = async (options: { startDate?: string; endDate?: string; compare?: boolean } = {}): Promise<StatsResult & { comparison?: StatsResult }> => {
    const { startDate, endDate, compare } = options;
    
    // --- Current Period ---
    let currentQuery = supabase.from('jobs').select('branch_name, priority, created_at, status, history');
    if (startDate) {
        currentQuery = currentQuery.gte('created_at', startDate);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        currentQuery = currentQuery.lte('created_at', end.toISOString());
    }
    
    const { data: currentJobs, error } = await currentQuery;
    if (error) throw error;
    // FIX: The type cast to `any` is a temporary measure to satisfy the compiler, as `processJobsToStats` expects a specific Pick<Job, ...> type.
    const currentStats = processJobsToStats(currentJobs as any);

    if (!compare || !startDate || !endDate) {
        return { ...currentStats, comparison: undefined };
    }

    // --- Comparison Period ---
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();

    const comparisonEndDate = new Date(start.getTime() - (24 * 60 * 60 * 1000)); // Day before the start
    const comparisonStartDate = new Date(comparisonEndDate.getTime() - duration);
    
    let comparisonQuery = supabase.from('jobs').select('branch_name, priority, created_at, status, history');
    comparisonQuery = comparisonQuery.gte('created_at', comparisonStartDate.toISOString().split('T')[0]);
    
    const comparisonEnd = new Date(comparisonEndDate);
    comparisonEnd.setUTCHours(23, 59, 59, 999);
    comparisonQuery = comparisonQuery.lte('created_at', comparisonEnd.toISOString());

    const { data: comparisonJobs, error: comparisonError } = await comparisonQuery;
    if (comparisonError) throw comparisonError;
    // FIX: The type cast to `any` is a temporary measure to satisfy the compiler.
    const comparisonStats = processJobsToStats(comparisonJobs as any);

    return { ...currentStats, comparison: comparisonStats };
};


export const apiGetLabStats = async (): Promise<Record<string, number>> => {
    const { data, error } = await supabase.from('jobs').select('status, priority');
    if (error) throw error;

    const stats = data.reduce((acc, job) => {
        if(job.status) {
            acc[job.status] = (acc[job.status] || 0) + 1;
        }
        if (job.priority !== JobPriority.Normal && (job.status === JobStatus.SentToLab || job.status === JobStatus.ReceivedByLab)) {
            acc.withAlerts = (acc.withAlerts || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    return stats;
}


export const apiAddUser = async (userData: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert(userData).select().single();
    if (error) {
        if (error.code === '23505') { // Error de violación de unicidad
            throw new Error('El nombre de usuario ya existe.');
        }
        throw error;
    }
    return data as User;
};

export const apiUpdateUserPassword = async (id: string, newPassword: string):Promise<User> => {
    const { data, error } = await supabase.from('users').update({ password: newPassword }).eq('id', id).select().single();
    if (error) throw error;
    return data as User;
};

export const apiDeleteUser = async (id: string): Promise<{ success: true }> => {
    // Lógica para no eliminar al último admin
    const { data: userToDelete, error: fetchError } = await supabase.from('users').select('role').eq('id', id).single();
    if (fetchError) throw fetchError;
    if(userToDelete.role === Role.Admin){
        const { count } = await supabase.from('users').select('*', { count: 'exact' }).eq('role', Role.Admin);
        if (count === 1) {
            throw new Error('No se puede eliminar al último administrador.');
        }
    }
    
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
};

// --- Admin: Announcements ---
export const apiGetAnnouncements = async (): Promise<Announcement[]> => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Announcement[]) || [];
};

export const apiAddAnnouncement = async (message: string): Promise<Announcement> => {
    const { data, error } = await supabase.from('announcements').insert({ message }).select().single();
    if (error) throw error;
    return data as Announcement;
};

export const apiDeleteAnnouncement = async (id: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
};
