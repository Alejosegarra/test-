
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useTheme, useRefresh } from '../App';
import { Role, type Announcement } from '../types';
import * as api from '../services/api';
import { supabase } from '../services/supabaseClient';
import { Button } from './common/UI';
import { EyeIcon, LogOutIcon, SunIcon, MoonIcon, RefreshCwIcon } from './common/Icons';
import { AnnouncementsBanner } from './common/AnnouncementsBanner';
import AdminPanel from './admin/AdminPanel';
import BranchView from './branch/BranchView';
import LabView from './lab/LabView';


// --- MAIN DASHBOARD COMPONENT ---
const Dashboard: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { refreshKey, triggerRefresh } = useRefresh();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);

    const fetchAnnouncements = useCallback(() => {
        api.apiGetAnnouncements().then(setAnnouncements);
    }, []);

    useEffect(() => {
        fetchAnnouncements();
        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAnnouncements, refreshKey]);


    const renderContent = () => {
        if (!currentUser) return null;
        switch (currentUser.role) {
            case Role.Admin:
                return <AdminPanel user={currentUser} announcements={announcements} onAnnouncementsUpdate={fetchAnnouncements} />;
            case Role.Branch:
                return <BranchView user={currentUser} />;
            case Role.Lab:
                return <LabView user={currentUser} />;
            default:
                return <p>Rol de usuario no reconocido.</p>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 dark:border-b dark:border-slate-700 shadow-md sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <EyeIcon className="h-8 w-8 text-blue-600" />
                        <span className="text-xl font-bold text-gray-800 dark:text-slate-100 hidden sm:inline">Optica Schellhas</span>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <div className="text-right">
                           <p className="font-semibold text-gray-700 dark:text-slate-200">{currentUser?.username}</p>
                           <p className="text-sm text-gray-500 dark:text-slate-400">
                                {currentUser?.role}
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={triggerRefresh} aria-label="Actualizar datos">
                           <RefreshCwIcon className="h-6 w-6"/>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Cambiar tema">
                           {theme === 'light' ? <MoonIcon className="h-6 w-6"/> : <SunIcon className="h-6 w-6"/>}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={logout} aria-label="Cerrar sesión">
                           <LogOutIcon className="h-6 w-6"/>
                        </Button>
                    </div>
                </div>
            </header>
            <AnnouncementsBanner announcements={announcements} />
            <main className="container mx-auto p-4 md:p-6">
                {renderContent()}
            </main>
        </div>
    );
};


export default Dashboard;