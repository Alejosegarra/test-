import React from 'react';
import { JobStatus, JobPriority } from '../types';
import { AlertTriangleIcon, CheckCircleIcon, SendIcon, TruckIcon, CheckIcon, RepeatIcon } from './common/Icons';

export const statusConfig = {
    [JobStatus.PendingInBranch]: { text: 'Pendiente en Sucursal', color: 'bg-gray-500', icon: null },
    [JobStatus.SentToLab]: { text: 'Enviado a Laboratorio', color: 'bg-blue-500', icon: React.createElement(SendIcon, { className: "h-4 w-4 mr-1"}) },
    [JobStatus.ReceivedByLab]: { text: 'Recibido en Laboratorio', color: 'bg-indigo-500', icon: React.createElement(CheckIcon, { className: "h-4 w-4 mr-1"}) },
    [JobStatus.Completed]: { text: 'Terminado', color: 'bg-green-500', icon: React.createElement(CheckCircleIcon, { className: "h-4 w-4 mr-1"}) },
    [JobStatus.SentToBranch]: { text: 'Enviado a Sucursal', color: 'bg-purple-500', icon: React.createElement(TruckIcon, { className: "h-4 w-4 mr-1"}) },
    [JobStatus.ReceivedByBranch]: { text: 'Recibido en Sucursal', color: 'bg-emerald-600', icon: React.createElement(CheckCircleIcon, { className: "h-4 w-4 mr-1"}) },
};

export const priorityConfig = {
    [JobPriority.Normal]: { text: 'Normal', color: 'text-gray-400 dark:text-slate-500', icon: null },
    [JobPriority.Urgente]: { text: 'Urgente', color: 'text-yellow-500', icon: React.createElement(AlertTriangleIcon, { className: "h-5 w-5" }) },
    [JobPriority.Repeticion]: { text: 'Repetición', color: 'text-orange-500', icon: React.createElement(RepeatIcon, { className: "h-5 w-5" }) },
};
