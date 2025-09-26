import React from 'react';
import type { SparePartOrder } from '../../types';
import { Modal } from './UI';
import { CheckCircleIcon } from './Icons';

export const SparePartOrderHistoryModal: React.FC<{ order: SparePartOrder | null; onClose: () => void }> = ({ order, onClose }) => {
    if (!order) return null;

    return (
        <Modal isOpen={!!order} onClose={onClose} title={`Historial del Pedido`} size="lg">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="text-sm dark:text-slate-300 bg-gray-50 dark:bg-slate-700/50 p-3 rounded-md">
                    <p><strong>Proveedor:</strong> {order.supplier}</p>
                    <p><strong>Descripción:</strong> {order.description}</p>
                    <p><strong>Sucursal:</strong> {order.branch_name}</p>
                    <p><strong>Pedido por:</strong> {order.requested_by || 'N/A'}</p>
                    <p><strong>Creado:</strong> {new Date(order.created_at).toLocaleString('es-ES')}</p>
                </div>
                <ul className="space-y-3">
                    {[...(order.history || [])].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, index) => (
                        <li key={index} className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                               <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-slate-200">{entry.status}</p>
                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                    Por <span className="font-medium">{entry.updatedBy}</span> el {new Date(entry.timestamp).toLocaleString('es-ES')}
                                </p>
                                {entry.notes && (
                                    <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 pl-4 border-l-2 dark:border-slate-600">
                                        {entry.notes}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
};