

export enum Role {
  Admin = 'ADMIN',
  Branch = 'SUCURSAL',
  Lab = 'LABORATORIO',
  Repuestos = 'REPUESTOS',
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
  linked_spare_part?: {
    id: string;
    status: SparePartOrderStatus;
  };
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

// --- Spare Parts ---
export enum SparePartOrderStatus {
  Ordered = 'PEDIDO',
  ReceivedCentral = 'RECIBIDO EN CENTRAL',
  SentToBranch = 'ENVIADO A SUCURSAL',
  ReceivedByBranch = 'RECIBIDO EN SUCURSAL',
  Cancelled = 'CANCELADO',
}

export enum SparePartOrderPriority {
    Normal = 'NORMAL',
    Urgente = 'URGENTE',
}

export enum SparePartOrderType {
    Warranty = 'GARANTIA',
    Chargeable = 'CON CARGO',
}

export interface SparePartOrderHistoryEntry {
  timestamp: string;
  status: SparePartOrderStatus | string;
  updatedBy: string;
  notes?: string;
}

export interface SparePartOrder {
  id: string; // uuid
  created_at: string;
  updated_at: string;
  branch_id: string;
  branch_name: string;
  supplier: string;
  description: string;
  requested_by?: string;
  priority: SparePartOrderPriority;
  order_type: SparePartOrderType;
  order_reference?: string;
  status: SparePartOrderStatus;
  notes?: string;
  history: SparePartOrderHistoryEntry[];
  job_id?: string;
}