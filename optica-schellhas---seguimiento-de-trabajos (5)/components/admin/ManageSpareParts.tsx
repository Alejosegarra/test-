import React, { useState, useEffect, useCallback } from 'react';
import { useToast, useRefresh } from '../../App';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import type { User, SparePartOrder, Job } from '../../types';
import { SparePartOrderStatus, Role, SparePartOrderPriority, SparePartOrderType } from '../../types';
import { Button, Input, Card, CardHeader, CardContent, Select, Modal, SearchableSelect } from '../common/UI';
import { PackageIcon, PlusIcon, EditIcon, TrashIcon, HistoryIcon, ChevronRightIcon, AlertTriangleIcon, ShieldCheckIcon, DollarSignIcon, LinkIcon, CheckIcon, TruckIcon } from '../common/Icons';
import { Pagination } from '../common/Pagination';
import { SparePartOrderHistoryModal } from '../common/SparePartOrderHistoryModal';

const PAGE_SIZE_OPTIONS = [15, 30, 50];

const statusOptions = Object.values(SparePartOrderStatus).map(s => ({ value: s, label: s }));
const priorityOptions = Object.values(SparePartOrderPriority).map(p => ({ value: p, label: p }));
const typeOptions = Object.values(SparePartOrderType).map(t => ({ value: t, label: t }));

const statusConfig: Record<SparePartOrderStatus, { text: string; color: string; }> = {
    [SparePartOrderStatus.Ordered]: { text: 'Pedido', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    [SparePartOrderStatus.ReceivedCentral]: { text: 'Recibido en Central', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
    [SparePartOrderStatus.SentToBranch]: { text: 'Enviado a Sucursal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    [SparePartOrderStatus.ReceivedByBranch]: { text: 'Recibido en Sucursal', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    [SparePartOrderStatus.Cancelled]: { text: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};


const ManageSpareParts: React.FC<{ user: User }> = ({ user }) => {
    const [orders, setOrders] = useState<SparePartOrder[]>([]);
    const [branches, setBranches] = useState<Pick<User, 'id' | 'username'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({
        searchTerm: '',
        status: '',
        branchId: '',
        priority: '',
        orderType: '',
    });
    const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'priority'>('created_at');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Partial<SparePartOrder> | null>(null);
    const [modalRepairJobs, setModalRepairJobs] = useState<Pick<Job, 'id' | 'description'>[]>([]);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingOrder, setDeletingOrder] = useState<SparePartOrder | null>(null);
    const [viewingHistoryOrder, setViewingHistoryOrder] = useState<SparePartOrder | null>(null);
    
    const { addToast } = useToast();
    const { refreshKey } = useRefresh();

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [ordersResponse, branchesData] = await Promise.all([
                api.apiGetSparePartOrders(user, {
                    page: currentPage,
                    pageSize: pageSize,
                    searchTerm: filters.searchTerm,
                    sortBy,
                    statusFilter: filters.status as SparePartOrderStatus,
                    branchIdFilter: filters.branchId,
                    priorityFilter: filters.priority as SparePartOrderPriority,
                    orderTypeFilter: filters.orderType as SparePartOrderType,
                }),
                api.apiGetAllBranches(),
            ]);
            setOrders(ordersResponse.orders);
            setTotalOrders(ordersResponse.count);
            setBranches(branchesData);
        } catch (error) {
            addToast('Error al cargar los pedidos de repuestos.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user, addToast, currentPage, pageSize, filters, sortBy]);
    
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData, refreshKey]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, sortBy, pageSize]);
    
    useEffect(() => {
        const channel = supabase
            .channel('public:spare_part_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'spare_part_orders' }, fetchAllData)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAllData]);

    useEffect(() => {
        if (isModalOpen && editingOrder?.branch_id) {
            const fetchRepairs = async () => {
                try {
                    const jobs = await api.apiGetOpenRepairJobsForBranch(editingOrder.branch_id!);
                    const activeOrdersResponse = await api.apiGetSparePartOrders(user, { statusFilter: 'ACTIVE', pageSize: 9999 });
                    const linkedJobIds = new Set(
                        activeOrdersResponse.orders
                            .map(o => o.job_id)
                            .filter((id): id is string => !!id)
                    );
                    
                    const availableJobs = jobs.filter(job => 
                        !linkedJobIds.has(job.id) || (editingOrder.job_id && editingOrder.job_id === job.id)
                    );
                    setModalRepairJobs(availableJobs);
                } catch {
                    setModalRepairJobs([]);
                }
            };
            fetchRepairs();
        } else if (!isModalOpen) {
            setModalRepairJobs([]);
        }
    }, [isModalOpen, editingOrder?.branch_id, editingOrder?.job_id, user, addToast]);

    const handleOpenModal = (order: SparePartOrder | null = null) => {
        setEditingOrder(order ? { ...order } : { branch_id: branches[0]?.id, status: SparePartOrderStatus.Ordered, priority: SparePartOrderPriority.Normal, order_type: SparePartOrderType.Chargeable });
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
    };
    
    const handleUpdateStatus = async (orderId: string, newStatus: SparePartOrderStatus) => {
        try {
            await api.apiUpdateSparePartOrder(orderId, { status: newStatus }, user);
            addToast('Estado del pedido actualizado.', 'success');
            fetchAllData();
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };

    const handleSaveOrder = async () => {
        if (!editingOrder) return;
        
        try {
            const branch = branches.find(b => b.id === editingOrder.branch_id);
            if (!branch) throw new Error("Sucursal no válida");

            const orderData = { ...editingOrder, branch_name: branch.username };

            if (orderData.id) { // Editing
                await api.apiUpdateSparePartOrder(orderData.id, { ...orderData, job_id: orderData.job_id || undefined }, user);
                addToast(`Pedido actualizado exitosamente.`, 'success');
            } else { // Creating
                if (!orderData.supplier || !orderData.description) {
                    addToast('Proveedor y descripción son obligatorios.', 'error');
                    return;
                }
                await api.apiCreateSparePartOrder({
                    supplier: orderData.supplier,
                    description: orderData.description,
                    branch_id: orderData.branch_id!,
                    branch_name: orderData.branch_name!,
                    requested_by: orderData.requested_by,
                    priority: orderData.priority || SparePartOrderPriority.Normal,
                    order_type: orderData.order_type || SparePartOrderType.Chargeable,
                    order_reference: orderData.order_reference,
                    notes: orderData.notes,
                    job_id: orderData.job_id || undefined,
                }, user);
                addToast(`Pedido creado exitosamente.`, 'success');
            }
            handleCloseModal();
            fetchAllData();
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
    const handleOpenDeleteModal = (order: SparePartOrder) => {
        setDeletingOrder(order);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingOrder) return;
        try {
            await api.apiDeleteSparePartOrder(deletingOrder.id);
            addToast(`Pedido eliminado.`, 'success');
            setIsDeleteModalOpen(false);
            setDeletingOrder(null);
            fetchAllData();
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
    const modalRepairJobOptions = modalRepairJobs.map(job => ({ value: job.id, label: `#${job.id} - ${job.description.substring(0, 50)}`}));

    return (
        <>
            <SparePartOrderHistoryModal order={viewingHistoryOrder} onClose={() => setViewingHistoryOrder(null)} />
            <Card>
                <CardHeader className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center"><PackageIcon className="h-6 w-6 mr-2 text-gray-600 dark:text-slate-400"/>Gestionar Pedidos de Repuestos</h2>
                    <Button onClick={() => handleOpenModal()}><PlusIcon className="h-5 w-5 mr-2"/>Crear Pedido</Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
                        <Input 
                            value={filters.searchTerm}
                            onChange={(e) => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
                            placeholder="Buscar..."
                            className="lg:col-span-2"
                        />
                         <Select value={filters.branchId} onChange={(e) => setFilters(f => ({ ...f, branchId: e.target.value }))}>
                             <option value="">Todas las Sucursales</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.username}</option>)}
                        </Select>
                        <Select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
                            <option value="">Todos los Estados</option>
                            {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                        <Select value={filters.priority} onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}>
                            <option value="">Todas las Prioridades</option>
                            {priorityOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                         <Select value={filters.orderType} onChange={(e) => setFilters(f => ({ ...f, orderType: e.target.value }))}>
                            <option value="">Todos los Tipos</option>
                            {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                    </div>

                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-slate-700">
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Sucursal</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Proveedor</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Descripción</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden lg:table-cell">Trabajo Vinculado</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden sm:table-cell">Vendedor</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Estado</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 hidden md:table-cell">Fecha Pedido</th>
                                    <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={8} className="text-center p-6">Cargando...</td></tr>
                                ) : orders.length > 0 ? orders.map(order => (
                                    <tr key={order.id} className={`border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 ${order.priority === SparePartOrderPriority.Urgente ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                                        <td className="p-3 text-gray-800 dark:text-slate-300">{order.branch_name}</td>
                                        <td className="p-3 font-medium text-gray-900 dark:text-slate-200">{order.supplier}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400 max-w-xs truncate">{order.description}</td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400 hidden lg:table-cell">
                                            {order.job_id ? (
                                                <span className="font-mono text-indigo-600 dark:text-indigo-400">#{order.job_id}</span>
                                            ) : 'N/A'}
                                        </td>
                                        <td className="p-3 text-gray-600 dark:text-slate-400 hidden sm:table-cell">{order.requested_by}</td>
                                        <td className="p-3">
                                            <div className="flex items-center">
                                                {order.priority === SparePartOrderPriority.Urgente && <AlertTriangleIcon className="h-4 w-4 mr-1.5 text-yellow-500" title="Urgente"/>}
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusConfig[order.status].color}`}>{statusConfig[order.status].text}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-500 dark:text-slate-500 hidden md:table-cell">{new Date(order.created_at).toLocaleDateString('es-ES')}</td>
                                        <td className="p-3 text-right space-x-1">
                                            {order.status === SparePartOrderStatus.Ordered && (
                                                <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(order.id, SparePartOrderStatus.ReceivedCentral)} title="Marcar como Recibido en Central">
                                                    <CheckIcon className="h-5 w-5 text-indigo-500"/>
                                                </Button>
                                            )}
                                            {order.status === SparePartOrderStatus.ReceivedCentral && (
                                                <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(order.id, SparePartOrderStatus.SentToBranch)} title="Enviar a Sucursal">
                                                    <TruckIcon className="h-5 w-5 text-purple-500"/>
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => setViewingHistoryOrder(order)} title="Ver historial"><HistoryIcon className="h-5 w-5"/></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(order)} title="Editar"><EditIcon className="h-5 w-5"/></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenDeleteModal(order)} title="Eliminar"><TrashIcon className="h-5 w-5 text-red-500"/></Button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={8} className="text-center p-6 text-gray-500 dark:text-slate-400">No se encontraron pedidos.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={Math.ceil(totalOrders / pageSize)}
                        onPageChange={setCurrentPage}
                        totalItems={totalOrders}
                        pageSize={pageSize}
                        onPageSizeChange={setPageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                    />
                </CardContent>
            </Card>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingOrder?.id ? 'Editar Pedido' : 'Crear Pedido'}>
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Sucursal</label>
                            <Select 
                                value={editingOrder?.branch_id || ''} 
                                onChange={e => setEditingOrder(prev => ({...prev, branch_id: e.target.value, job_id: ''}))} // Reset job_id on branch change
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.username}</option>)}
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Vendedor</label>
                            <Input value={editingOrder?.requested_by || ''} onChange={e => setEditingOrder({...editingOrder, requested_by: e.target.value})} />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Proveedor</label>
                        <Input value={editingOrder?.supplier || ''} onChange={e => setEditingOrder({...editingOrder, supplier: e.target.value})} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descripción</label>
                        <Input value={editingOrder?.description || ''} onChange={e => setEditingOrder({...editingOrder, description: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Asociar a Trabajo de Reparación (Opcional)</label>
                        <SearchableSelect
                            value={editingOrder?.job_id || ''}
                            onChange={value => setEditingOrder(prev => ({ ...prev, job_id: value }))}
                            options={modalRepairJobOptions}
                            placeholder={editingOrder?.branch_id ? 'Buscar trabajo...' : 'Seleccione una sucursal primero'}
                            disabled={!editingOrder?.branch_id}
                        />
                         <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Solo se muestran reparaciones sin un pedido de repuesto activo.</p>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nº Pedido/Referencia (Opcional)</label>
                        <Input value={editingOrder?.order_reference || ''} onChange={e => setEditingOrder({...editingOrder, order_reference: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Estado</label>
                            <Select value={editingOrder?.status || ''} onChange={e => setEditingOrder({...editingOrder, status: e.target.value as SparePartOrderStatus})}>
                                {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Prioridad</label>
                            <Select value={editingOrder?.priority || ''} onChange={e => setEditingOrder({...editingOrder, priority: e.target.value as SparePartOrderPriority})}>
                                {priorityOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Tipo</label>
                            <Select value={editingOrder?.order_type || ''} onChange={e => setEditingOrder({...editingOrder, order_type: e.target.value as SparePartOrderType})}>
                                {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Notas</label>
                         <Input value={editingOrder?.notes || ''} onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})} placeholder="Añadir nota o comentario..." />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSaveOrder}>Guardar</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Eliminación">
                <p>¿Está seguro de que desea eliminar este pedido de repuesto? Esta acción no se puede deshacer.</p>
                <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>Eliminar</Button>
                </div>
            </Modal>
        </>
    );
};

export default ManageSpareParts;