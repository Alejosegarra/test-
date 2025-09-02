import React, { useState } from 'react';
import { useToast } from '../../App';
import { type Announcement } from '../../types';
import * as api from '../../services/api';
import { Button, Input, Card, CardHeader, CardContent } from '../common/UI';
import { MegaphoneIcon, TrashIcon } from '../common/Icons';

const ManageAnnouncements: React.FC<{announcements: Announcement[], onUpdate: () => void}> = ({announcements, onUpdate}) => {
    const [newMessage, setNewMessage] = useState('');
    const { addToast } = useToast();

    const handleAdd = async () => {
        if (!newMessage.trim()) return;
        try {
            await api.apiAddAnnouncement(newMessage.trim());
            addToast('Anuncio creado.', 'success');
            setNewMessage('');
            // Realtime will trigger the update
        } catch (error) {
            addToast('Error al crear anuncio.', 'error');
        }
    };
    
    const handleDelete = async (id: string) => {
        try {
            await api.apiDeleteAnnouncement(id);
            addToast('Anuncio eliminado.', 'success');
            // Realtime will trigger the update
        } catch (error) {
            addToast('Error al eliminar anuncio.', 'error');
        }
    };

    return (
        <Card>
             <CardHeader>
                 <h2 className="text-xl font-bold text-gray-800 flex items-center"><MegaphoneIcon className="h-6 w-6 mr-2 text-gray-600"/>Gestionar Anuncios</h2>
             </CardHeader>
             <CardContent>
                <div className="flex gap-2 mb-6">
                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Nuevo anuncio..."/>
                    <Button onClick={handleAdd}>Añadir</Button>
                </div>
                <ul className="space-y-3">
                    {announcements.map(ann => (
                        <li key={ann.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-gray-800">{ann.message}</p>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)}><TrashIcon className="h-5 w-5 text-red-500"/></Button>
                        </li>
                    ))}
                    {announcements.length === 0 && <p className="text-gray-500 text-center py-4">No hay anuncios activos.</p>}
                </ul>
             </CardContent>
        </Card>
    )
}

export default ManageAnnouncements;
