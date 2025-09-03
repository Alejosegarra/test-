import { Role, JobStatus, JobPriority, type User, type Job, type Announcement, type BranchStats, type LabDashboardStats } from '../types';
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
        sortBy?: 'updated_at' | 'priority';
        statusFilter?: JobStatus | 'HISTORY' | 'ACTIVE_BRANCH' | 'ALL' | '';
        priorityFilter?: JobPriority[];
        startDate?: string;
        endDate?: string;
        branchIdFilter?: string;
        disablePagination?: boolean;
    } = {}
): Promise<{ jobs: Job[]; count: number }> => {
    const { page = 1, pageSize = 15, searchTerm, sortBy = 'updated_at', statusFilter, priorityFilter, startDate, endDate, branchIdFilter, disablePagination } = options;
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
                query = query.eq('status', JobStatus.SentToBranch);
            } else {
                query = query.in('status', [JobStatus.Completed, JobStatus.SentToBranch]);
            }
        } else if (statusFilter === 'ACTIVE_BRANCH') {
            query = query.not('status', 'in', `("${JobStatus.Completed}","${JobStatus.SentToBranch}")`);
        } else {
            query = query.eq('status', statusFilter);
        }
    }

    if (priorityFilter && priorityFilter.length > 0) {
        query = query.in('priority', priorityFilter);
    }
    
    if (startDate) {
        query = query.gte('created_at', startDate);
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
    }

    if (searchTerm) {
        query = query.or(`id.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,branch_name.ilike.%${searchTerm}%`);
    }

    if (sortBy === 'priority') {
        query = query.order('priority', { ascending: false }).order('updated_at', { ascending: false });
    } else {
        query = query.order('updated_at', { ascending: false });
    }
    
    if (!disablePagination) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
    }

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

export const apiGetStats = async (): Promise<{
    totalJobs: number;
    jobsByBranch: Record<string, number>;
    jobsByPriority: Record<JobPriority, number>;
}> => {
    const { data: allJobs, error } = await supabase.from('jobs').select('branch_name, priority');
    if (error) throw error;
    
    const jobsByBranch = allJobs.reduce((acc, job) => {
        acc[job.branch_name] = (acc[job.branch_name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const jobsByPriority = allJobs.reduce((acc, job) => {
        acc[job.priority] = (acc[job.priority] || 0) + 1;
        return acc;
    }, {} as Record<JobPriority, number>);
    
    return {
        totalJobs: allJobs.length,
        jobsByBranch,
        jobsByPriority,
    }
};

// --- Dashboards Stats ---
export const apiGetLabDashboardStats = async (): Promise<LabDashboardStats> => {
    const { data, error } = await supabase.from('jobs').select('status, priority, branch_name');
    if (error) throw error;

    const stats: LabDashboardStats = {
        jobsByStatus: {},
        withAlerts: 0,
        activeJobsByBranch: [],
        repetitionsByBranch: []
    };
    
    const activeJobsByBranchMap: Record<string, number> = {};
    const repetitionsByBranchMap: Record<string, number> = {};
    const activeStatuses = [JobStatus.SentToLab, JobStatus.ReceivedByLab];

    data.forEach(job => {
        // jobs by status
        if (job.status) {
            stats.jobsByStatus[job.status] = (stats.jobsByStatus[job.status] || 0) + 1;
        }
        // with alerts
        if (job.priority !== JobPriority.Normal && activeStatuses.includes(job.status)) {
            stats.withAlerts++;
        }
        // active jobs by branch
        if (activeStatuses.includes(job.status)) {
            activeJobsByBranchMap[job.branch_name] = (activeJobsByBranchMap[job.branch_name] || 0) + 1;
        }
        // repetitions by branch
        if (job.priority === JobPriority.Repeticion) {
            repetitionsByBranchMap[job.branch_name] = (repetitionsByBranchMap[job.branch_name] || 0) + 1;
        }
    });

    stats.activeJobsByBranch = Object.entries(activeJobsByBranchMap).map(([name, count]) => ({ name, count }));
    stats.repetitionsByBranch = Object.entries(repetitionsByBranchMap).map(([name, count]) => ({ name, count }));

    return stats;
};


export const apiGetBranchStats = async (branchId: string): Promise<BranchStats> => {
    // 1. Jobs this month
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const { count: jobsThisMonth, error: monthError } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .gte('created_at', startOfMonth);
    if (monthError) throw monthError;

    // 2. Repetition Percentage
    const { data: allJobs, error: allJobsError } = await supabase
        .from('jobs')
        .select('priority')
        .eq('branch_id', branchId);
    if(allJobsError) throw allJobsError;

    const totalJobs = allJobs.length;
    const repetitionJobs = allJobs.filter(j => j.priority === JobPriority.Repeticion).length;
    const repetitionPercentage = totalJobs > 0 ? Math.round((repetitionJobs / totalJobs) * 100) : 0;

    // 3. Avg Completion Time
    const { data: completedJobs, error: completedError } = await supabase
        .from('jobs')
        .select('created_at, updated_at')
        .eq('branch_id', branchId)
        .in('status', [JobStatus.Completed, JobStatus.SentToBranch]);
    if (completedError) throw completedError;

    let avgCompletionDays: number | null = null;
    if (completedJobs.length > 0) {
        const totalDuration = completedJobs.reduce((acc, job) => {
            const created = new Date(job.created_at).getTime();
            const completed = new Date(job.updated_at).getTime();
            return acc + (completed - created);
        }, 0);
        const avgDurationMs = totalDuration / completedJobs.length;
        avgCompletionDays = parseFloat((avgDurationMs / (1000 * 60 * 60 * 24)).toFixed(1));
    }

    return {
        jobsThisMonth: jobsThisMonth || 0,
        repetitionPercentage,
        avgCompletionDays
    }
};


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