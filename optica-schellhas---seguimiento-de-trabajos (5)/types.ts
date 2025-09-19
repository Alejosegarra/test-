

export enum Role {
  Admin = 'ADMIN',
  Branch = 'SUCURSAL',
  Lab = 'LABORATORIO',
}

export enum JobStatus {
  PendingInBranch = 'PENDIENTE EN SUCURSAL',
  SentToLab = 'ENVIADO A LABORATORIO',
  ReceivedByLab = 'RECIBIDO EN LABORATORIO',
  Completed = 'TERMINADO',
  SentToBranch = 'ENVIADO A SUCURSAL',
  ReceivedByBranch = 'RECIBIDO EN SUCURSAL',
}

export enum JobPriority {
    Normal = 'NORMAL',
    Urgente = 'URGENTE',
    Repeticion = 'REPETICION',
}

export enum JobType {
    Nuevo = 'TRABAJO NUEVO',
    Reparacion = 'REPARACION',
}

export interface JobHistoryEntry {
    timestamp: string;
    status: JobStatus | string;
    updatedBy: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
}

export interface Job {
  id: string; // This is the job number
  description: string;
  status: JobStatus;
  branch_id: string;
  branch_name: string;
  priority: JobPriority;
  priority_message: string;
  created_at: string;
  updated_at: string;
  history: JobHistoryEntry[];
  job_type: JobType;
}

export interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
}

export interface Announcement {
    id: string;
    message: string;
    created_at: string;
}

export interface StatsResult {
    totalJobs: number;
    jobsByBranch: Record<string, number>;
    jobsByPriority: Record<JobPriority, number>;
    monthlyProgress: { month: string; total: number; byBranch: Record<string, number> }[];
    averageCycleTime: number; // in hours
    repetitionRate: number; // as a percentage
    mostActiveBranch: string;
    cycleTimeByBranch: Record<string, number>; // in hours
    jobsByStatus: Record<string, number>;
    averageTimeInStatus: Record<string, number>; // in hours
}

export type BranchViewTab = 'toSend' | 'inProcess' | 'toReceive' | 'history';