
import React, { useState, useEffect, useCallback } from 'react';
import { useToast, useRefresh } from '../../App';
import { Role, type User } from '../../types';
import * as api from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import { Button, Input, Modal, Card, CardHeader, CardContent, Select } from '../common/UI';
import { UsersIcon, PlusIcon, KeyIcon, TrashIcon, EyeIcon } from '../common/Icons';

const ManageAccounts: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

    const [username, setUsername] = useState('');
    const [role, setRole] = useState<Role>(Role.Branch);
    const [password, setPassword] = useState('123');
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
    const { addToast } = useToast();
    const { refreshKey } = useRefresh();

    const fetchUsers = useCallback(async () => {
        setUsers(await api.apiGetUsers());
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers, refreshKey]);

    useEffect(() => {
        const channel = supabase
            .channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchUsers]);
    
    const handleOpenUserModal = () => {
        setUsername('');
        setRole(Role.Branch);
        setPassword('123');
        setUserModalOpen(true);
    };

    const handleOpenPasswordModal = (user: User) => {
        setEditingUser(user);
        setPassword('');
        setPasswordModalOpen(true);
    };

    const handleOpenDeleteModal = (user: User) => {
        setDeletingUser(user);
        setDeleteConfirmationText('');
        setDeleteModalOpen(true);
    };

    const togglePasswordVisibility = (userId: string) => {
        setVisiblePasswords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleSaveUser = async () => {
        try {
            await api.apiAddUser({ username, password, role });
            addToast(`Cuenta '${username}' creada exitosamente.`, 'success');
            setUserModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
    const handleSavePassword = async () => {
        if (editingUser && password) {
            await api.apiUpdateUserPassword(editingUser.id, password);
            addToast(`Contraseña para '${editingUser.username}' actualizada.`, 'success');
            setPasswordModalOpen(false);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (deletingUser && deleteConfirmationText === deletingUser.username) {
            try {
                await api.apiDeleteUser(deletingUser.id);
                addToast(`Cuenta '${deletingUser.username}' eliminada.`, 'success');
                setDeleteModalOpen(false);
                setDeletingUser(null);
                fetchUsers();
            } catch (error: any) {
                addToast(error.message, 'error');
            }
        }
    };

    return (
        <Card>
            <CardHeader className="flex justify-between items-center">
                 <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center"><UsersIcon className="h-6 w-6 mr-2 text-gray-600 dark:text-slate-400"/>Gestionar Cuentas</h2>
                </div>
                <Button onClick={handleOpenUserModal}><PlusIcon className="h-5 w-5 mr-2"/>Añadir Cuenta</Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b dark:border-slate-700">
                                <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Nombre de Usuario / Sucursal</th>
                                <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Rol</th>
                                <th className="p-3 font-semibold text-gray-700 dark:text-slate-300">Contraseña</th>
                                <th className="p-3 font-semibold text-gray-700 dark:text-slate-300 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <td className="p-3 font-medium text-gray-900 dark:text-slate-200">{user.username}</td>
                                    <td className="p-3 text-gray-600 dark:text-slate-400">{user.role}</td>
                                    <td className="p-3 text-gray-600 dark:text-slate-400 font-mono">
                                        <div className="flex items-center space-x-2">
                                            <span className="flex-grow">
                                                {visiblePasswords.has(user.id) ? user.password : '••••••••'}
                                            </span>
                                            <Button variant="ghost" size="sm" onClick={() => togglePasswordVisibility(user.id)} title="Mostrar/Ocultar contraseña" className="!p-1">
                                                <EyeIcon className="h-5 w-5 text-gray-600 dark:text-slate-300"/>
                                            </Button>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right space-x-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenPasswordModal(user)} title="Cambiar contraseña">
                                            <KeyIcon className="h-5 w-5 text-gray-600 dark:text-slate-300"/>
                                        </Button>
                                         <Button variant="ghost" size="sm" onClick={() => handleOpenDeleteModal(user)} title="Eliminar cuenta">
                                            <TrashIcon className="h-5 w-5 text-red-500"/>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>

            <Modal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} title="Añadir Nueva Cuenta">
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nombre de Usuario / Sucursal</label>
                        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej: Nueva Sucursal" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Rol</label>
                        <Select value={role} onChange={e => setRole(e.target.value as Role)}>
                            <option value={Role.Branch}>Sucursal</option>
                            <option value={Role.Lab}>Laboratorio</option>
                            <option value={Role.Admin}>Administrador</option>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Contraseña</label>
                        <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" type="password"/>
                    </div>
                    <Button onClick={handleSaveUser} className="w-full">Crear Cuenta</Button>
                </div>
            </Modal>
            
            <Modal isOpen={isPasswordModalOpen} onClose={() => setPasswordModalOpen(false)} title={`Cambiar contraseña para ${editingUser?.username}`}>
                 <div className="space-y-4">
                    <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Nueva contraseña" type="password" autoFocus/>
                    <Button onClick={handleSavePassword} className="w-full">Actualizar Contraseña</Button>
                </div>
            </Modal>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={`Eliminar cuenta`}>
                 <div className="space-y-4">
                    <p className="text-gray-700 dark:text-slate-300">
                        Esta acción es irreversible. Para confirmar, por favor escriba <strong className="text-red-600">{deletingUser?.username}</strong> en el campo de abajo.
                    </p>
                    <Input 
                        value={deleteConfirmationText} 
                        onChange={e => setDeleteConfirmationText(e.target.value)}
                        placeholder="Escriba el nombre para confirmar" 
                        autoFocus
                    />
                    <Button 
                        onClick={handleConfirmDelete} 
                        className="w-full" 
                        variant="danger"
                        disabled={deleteConfirmationText !== deletingUser?.username}
                    >
                        Eliminar permanentemente
                    </Button>
                </div>
            </Modal>
        </Card>
    );
};

export default ManageAccounts;