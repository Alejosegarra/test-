import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast, useRefresh } from '../../App';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import type { User, SparePartOrder, Job } from '../../types';
import { SparePartOrderStatus, SparePartOrderPriority, SparePartOrderType } from '../../types';
import { Button, Input, Card, CardContent, Select, Modal, SearchableSelect } from '../common/UI';
import { PlusIcon, CheckCircleIcon, XIcon, SendIcon, TruckIcon, CheckIcon, AlertTriangleIcon, HistoryIcon, ShieldCheckIcon, DollarSignIcon, LinkIcon } from '../common/Icons';
import { SparePartOrderHistoryModal } from '../common/SparePartOrderHistoryModal';

const statusConfig: Record<SparePartOrderStatus, { text: string; color: string; icon: React.ReactElement }> = {
    [SparePartOrderStatus.Ordered]: { text: 'Pedido', color: 'text-blue-500', icon: <SendIcon className="h-4 w-4" /> },
    [SparePartOrderStatus.ReceivedCentral]: { text: 'Recibido en Central', color: 'text-indigo-500', icon: <CheckIcon className="h-4 w-4" /> },
    [SparePartOrderStatus.SentToBranch]: { text: 'Enviado a Sucursal', color: 'text-purple-500', icon: <TruckIcon className="h-4 w-4" /> },
    [SparePartOrderStatus.ReceivedByBranch]: { text: 'Recibido en Sucursal', color: 'text-green-500', icon: <CheckCircleIcon className="h-4 w-4" /> },
    [SparePartOrderStatus.Cancelled]: { text: 'Cancelado', color: 'text-red-500', icon: <XIcon className="h-4 w-4" /> },
};

const OrderCard: React.FC<{ order: SparePartOrder, onUpdate: (id: string, status: SparePartOrderStatus) => void, onAddNote: (order: SparePartOrder) => void, onEdit: (order: SparePartOrder) => void, onViewHistory: (order: SparePartOrder) => void }> = ({ order, onUpdate, onAddNote, onEdit, onViewHistory }) => {
    const currentStatus = statusConfig[order.status];
    
    const canCancel = order.status === SparePartOrderStatus.Ordered;
    const canReceive = order.status === SparePartOrderStatus.SentToBranch;
    
    const typeConfig = order.order_type === SparePartOrderType.Warranty
        ? { icon: <ShieldCheckIcon className="h-4 w-4 text-green-600" />, text: 'Garantía', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' }
        : { icon: <DollarSignIcon className="h-4 w-4 text-blue-600" />, text: 'Con Cargo', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' };

    return (
        <Card className={`hover:shadow-md transition-shadow cursor-pointer ${order.priority === SparePartOrderPriority.Urgente ? 'border-l-4 border-yellow-400' : ''}`} onClick={() => onViewHistory(order)}>
            <CardContent>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                           {order.priority === SparePartOrderPriority.Urgente && <AlertTriangleIcon className="h-5 w-5 text-yellow-500" title="Pedido Urgente" />}
                           <p className="font-bold text-gray-800 dark:text-slate-200">{order.supplier}</p>
                           {order.order_reference && <span className="text-xs font-mono bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{order.order_reference}</span>}
                           <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${typeConfig.color}`}>{typeConfig.icon} {typeConfig.text}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{order.description}</p>
                        {order.job_id && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1 flex items-center">
                                <LinkIcon className="h-3 w-3 mr-1.5" />
                                Vinculado al trabajo #{order.job_id}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                           Pedido por: <span className="font-medium">{order.requested_by || 'No especificado'}</span>
                        </p>
                         <p className="text-xs text-gray-400 dark:text-slate-500">
                           Fecha: {new Date(order.created_at).toLocaleDateString('es-ES')}
                        </p>
                    </div>
                    <div className={`flex items-center text-sm font-semibold ${currentStatus.color}`}>
                        {React.cloneElement(currentStatus.icon, { className: "h-5 w-5 mr-2"})}
                        {currentStatus.text}
                    </div>
                </div>
                {order.notes && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-md">
                        <p className="text-xs text-gray-600 dark:text-slate-300"><span className="font-semibold">Última nota:</span> {order.notes}</p>
                    </div>
                )}
                <div className="mt-4 flex justify-end space-x-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onViewHistory(order); }}><HistoryIcon className="h-4 w-4 mr-1"/>Historial</Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(order); }}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onAddNote(order); }}>Añadir Nota</Button>
                    {canCancel && <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(order.id, SparePartOrderStatus.Cancelled); }}>Cancelar</Button>}
                    {canReceive && <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onUpdate(order.id, SparePartOrderStatus.ReceivedByBranch); }}>Marcar como Recibido</Button>}
                </div>
            </CardContent>
        </Card>
    );
};


const BranchSparePartsManager: React.FC<{ user: User }> = ({ user }) => {
    const [orders, setOrders] = useState<SparePartOrder[]>([]);
    const [repairJobs, setRepairJobs] = useState<Pick<Job, 'id' | 'description'>[]>([]);
    const [view, setView] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
    const [newOrder, setNewOrder] = useState({ supplier: '', description: '', requested_by: '', priority: SparePartOrderPriority.Normal, order_type: SparePartOrderType.Chargeable, job_id: '' });
    const { addToast } = useToast();
    const { refreshKey } = useRefresh();
    
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<SparePartOrder | null>(null);
    const [newNote, setNewNote] = useState('');
    const [viewingHistoryOrder, setViewingHistoryOrder] = useState<SparePartOrder | null>(null);

    const [filters, setFilters] = useState({
        searchTerm: '',
        orderType: '' as SparePartOrderType | '',
        priority: '' as SparePartOrderPriority | '',
    });

    const fetchOrders = useCallback(async () => {
        try {
            const { orders } = await api.apiGetSparePartOrders(user, { statusFilter: view, pageSize: 100 });
            setOrders(orders);
        } catch (error) {
            addToast('Error al cargar pedidos de repuestos.', 'error');
        }
    }, [user, view, addToast]);

    useEffect(() => {
        const fetchRepairs = async () => {
            try {
                const jobs = await api.apiGetOpenRepairJobsForBranch(user.id);
                setRepairJobs(jobs);
            } catch (err) {
                console.error("Failed to fetch repair jobs", err);
                addToast("No se pudieron cargar los trabajos de reparación.", 'error');
            }
        };
        fetchRepairs();
    }, [user.id, addToast, refreshKey]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders, refreshKey]);

    useEffect(() => {
        const channel = supabase
            .channel(`branch-spare-parts-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'spare_part_orders', filter: `branch_id=eq.${user.id}` }, fetchOrders)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchOrders, user.id]);

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrder.supplier || !newOrder.description || !newOrder.requested_by) {
            addToast('Proveedor, descripción y vendedor son obligatorios.', 'error');
            return;
        }
        try {
            await api.apiCreateSparePartOrder({
                ...newOrder,
                branch_id: user.id,
                branch_name: user.username,
                job_id: newOrder.job_id || undefined, // Send undefined if empty
            }, user);
            addToast('Pedido de repuesto creado.', 'success');
            setNewOrder({ supplier: '', description: '', requested_by: '', priority: SparePartOrderPriority.Normal, order_type: SparePartOrderType.Chargeable, job_id: '' });
            if(view !== 'ACTIVE') setView('ACTIVE');
            else fetchOrders();
        } catch (error: any) {
            addToast(error.message || 'Error al crear el pedido.', 'error');
        }
    };

    const handleUpdateOrder = async (id: string, status: SparePartOrderStatus) => {
        try {
            await api.apiUpdateSparePartOrder(id, { status }, user);
            addToast('Pedido actualizado.', 'success');
            fetchOrders();
        } catch (error) {
            addToast('Error al actualizar el pedido.', 'error');
        }
    };
    
    const handleOpenNoteModal = (order: SparePartOrder) => {
        setEditingOrder(order);
        setNewNote('');
        setIsNoteModalOpen(true);
    };

    const handleSaveNote = async () => {
        if (!editingOrder || !newNote.trim()) return;
        try {
            await api.apiUpdateSparePartOrder(editingOrder.id, { notes: newNote.trim() }, user);
            addToast('Nota añadida.', 'success');
            setIsNoteModalOpen(false);
            setEditingOrder(null);
            fetchOrders();
        } catch (error) {
            addToast('Error al añadir la nota.', 'error');
        }
    };

    const handleOpenEditModal = (order: SparePartOrder) => {
        setEditingOrder({ ...order });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingOrder) return;
        try {
            const { id, supplier, description, requested_by, priority, order_reference, order_type, job_id } = editingOrder;
            await api.apiUpdateSparePartOrder(id, { supplier, description, requested_by, priority, order_reference, order_type, job_id: job_id || undefined }, user);
            addToast('Pedido actualizado.', 'success');
            setIsEditModalOpen(false);
            setEditingOrder(null);
            fetchOrders();
        } catch (error: any) {
            addToast(error.message || 'Error al actualizar el pedido.', 'error');
        }
    };

    const repairJobOptions = useMemo(() => {
        const activeLinkedJobIds = new Set(
          orders
            .filter(o => ![SparePartOrderStatus.ReceivedByBranch, SparePartOrderStatus.Cancelled].includes(o.status))
            .map(o => o.job_id)
            .filter((id): id is string => !!id)
        );

        const currentEditingJobId = editingOrder?.job_id;

        return repairJobs
          .filter(job => !activeLinkedJobIds.has(job.id) || (currentEditingJobId && job.id === currentEditingJobId))
          .map(job => ({ value: job.id, label: `#${job.id} - ${job.description.substring(0, 50)}` }));
    }, [repairJobs, orders, editingOrder]);
    
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const searchTermLower = filters.searchTerm.toLowerCase();
            const searchMatch = filters.searchTerm === '' ||
                order.supplier.toLowerCase().includes(searchTermLower) ||
                order.description.toLowerCase().includes(searchTermLower) ||
                (order.requested_by && order.requested_by.toLowerCase().includes(searchTermLower)) ||
                (order.job_id && order.job_id.toLowerCase().includes(searchTermLower)) ||
                (order.order_reference && order.order_reference.toLowerCase().includes(searchTermLower));

            const typeMatch = filters.orderType === '' || order.order_type === filters.orderType;
            const priorityMatch = filters.priority === '' || order.priority === filters.priority;

            return searchMatch && typeMatch && priorityMatch;
        });
    }, [orders, filters]);

    return (
        <div className="flex flex-col max-h-[75vh]">
            <SparePartOrderHistoryModal order={viewingHistoryOrder} onClose={() => setViewingHistoryOrder(null)} />

            <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title={`Añadir Nota a Pedido`}>
                <div className="space-y-4">
                    <p><strong>Proveedor:</strong> {editingOrder?.supplier}</p>
                    <p><strong>Descripción:</strong> {editingOrder?.description}</p>
                    <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Escriba su nota aquí..." autoFocus />
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setIsNoteModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveNote}>Guardar Nota</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Pedido de Repuesto">
                {editingOrder && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Proveedor</label>
                            <Input value={editingOrder.supplier} onChange={e => setEditingOrder(p => p ? { ...p, supplier: e.target.value } : null)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción del Repuesto</label>
                            <Input value={editingOrder.description} onChange={e => setEditingOrder(p => p ? { ...p, description: e.target.value } : null)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Asociar a Trabajo de Reparación (Opcional)</label>
                             <SearchableSelect
                                value={editingOrder.job_id || ''}
                                onChange={value => setEditingOrder(p => p ? { ...p, job_id: value } : null)}
                                options={repairJobOptions}
                                placeholder="Buscar trabajo..."
                            />
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Solo se muestran reparaciones sin un pedido de repuesto activo.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nº Pedido/Referencia (Opcional)</label>
                            <Input value={editingOrder.order_reference || ''} onChange={e => setEditingOrder(p => p ? { ...p, order_reference: e.target.value } : null)} placeholder="Nº de seguimiento del proveedor" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Vendedor que solicita</label>
                            <Input value={editingOrder.requested_by || ''} onChange={e => setEditingOrder(p => p ? { ...p, requested_by: e.target.value } : null)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
                                <Select value={editingOrder.priority} onChange={e => setEditingOrder(p => p ? { ...p, priority: e.target.value as SparePartOrderPriority } : null)}>
                                    <option value={SparePartOrderPriority.Normal}>Normal</option>
                                    <option value={SparePartOrderPriority.Urgente}>Urgente</option>
                                </Select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
                                <Select value={editingOrder.order_type} onChange={e => setEditingOrder(p => p ? { ...p, order_type: e.target.value as SparePartOrderType } : null)}>
                                    <option value={SparePartOrderType.Chargeable}>Con Cargo</option>
                                    <option value={SparePartOrderType.Warranty}>Garantía</option>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <div className="flex-grow overflow-y-auto space-y-6 pr-4">
                <Card>
                    <CardContent>
                        <form onSubmit={handleCreateOrder} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                 <div className="h-full flex flex-col justify-end">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Proveedor</label>
                                    <Input value={newOrder.supplier} onChange={e => setNewOrder(p => ({ ...p, supplier: e.target.value }))} placeholder="Ej: Luxottica" required />
                                </div>
                                 <div className="h-full flex flex-col justify-end">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descripción del Repuesto</label>
                                    <Input value={newOrder.description} onChange={e => setNewOrder(p => ({ ...p, description: e.target.value }))} placeholder="Ej: Varilla Ray-Ban 3025" required />
                                </div>
                                <div className="h-full flex flex-col justify-end">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Vendedor que solicita</label>
                                    <Input value={newOrder.requested_by} onChange={e => setNewOrder(p => ({ ...p, requested_by: e.target.value }))} placeholder="Nombre del vendedor" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Asociar a Trabajo de Reparación (Opcional)</label>
                                <SearchableSelect
                                    value={newOrder.job_id}
                                    onChange={value => setNewOrder(p => ({ ...p, job_id: value }))}
                                    options={repairJobOptions}
                                    placeholder="Buscar y seleccionar un trabajo..."
                                />
                                 <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Solo se muestran reparaciones sin un pedido de repuesto activo.</p>
                            </div>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                <div className="flex gap-x-4 gap-y-2 flex-wrap">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridad</label>
                                        <Select value={newOrder.priority} onChange={e => setNewOrder(p => ({ ...p, priority: e.target.value as SparePartOrderPriority }))}>
                                            <option value={SparePartOrderPriority.Normal}>Normal</option>
                                            <option value={SparePartOrderPriority.Urgente}>Urgente</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
                                        <div className="flex items-center space-x-2">
                                            {(Object.values(SparePartOrderType) as SparePartOrderType[]).map(type => (
                                                <Button 
                                                    key={type}
                                                    type="button"
                                                    variant={newOrder.order_type === type ? 'primary' : 'secondary'}
                                                    onClick={() => setNewOrder(p => ({ ...p, order_type: type }))}
                                                >
                                                    {type}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full md:w-auto"><PlusIcon className="h-5 w-5 mr-2" />Crear Pedido</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div>
                    <div className="border-b border-gray-200 dark:border-slate-700">
                        <nav className="-mb-px flex space-x-4">
                            <button onClick={() => setView('ACTIVE')} className={`py-2 px-3 font-medium text-sm ${view === 'ACTIVE' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Pedidos Activos</button>
                            <button onClick={() => setView('HISTORY')} className={`py-2 px-3 font-medium text-sm ${view === 'HISTORY' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Historial</button>
                        </nav>
                    </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input 
                            placeholder="Buscar por proveedor, descripción, vendedor..."
                            value={filters.searchTerm}
                            onChange={e => setFilters(p => ({...p, searchTerm: e.target.value}))}
                            className="md:col-span-1"
                        />
                         <Select value={filters.orderType} onChange={e => setFilters(p => ({...p, orderType: e.target.value as SparePartOrderType | ''}))}>
                            <option value="">Todos los Tipos</option>
                            {Object.values(SparePartOrderType).map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                        <Select value={filters.priority} onChange={e => setFilters(p => ({...p, priority: e.target.value as SparePartOrderPriority | ''}))}>
                            <option value="">Todas las Prioridades</option>
                            {Object.values(SparePartOrderPriority).map(p => <option key={p} value={p}>{p}</option>)}
                        </Select>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map(order => (
                            <OrderCard key={order.id} order={order} onUpdate={handleUpdateOrder} onAddNote={handleOpenNoteModal} onEdit={handleOpenEditModal} onViewHistory={setViewingHistoryOrder} />
                        ))
                    ) : (
                        <p className="text-center text-gray-500 dark:text-slate-400">No hay pedidos para esta vista.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BranchSparePartsManager;