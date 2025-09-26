import React, { useState } from 'react';
import type { User } from '../../types';
import ManageSpareParts from '../admin/ManageSpareParts';
import RepairsWaitingView from './RepairsWaitingView';

type SparePartViewTab = 'orders' | 'repairs';

const SparePartsView: React.FC<{ user: User }> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<SparePartViewTab>('orders');

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100">
                Gestión Central de Repuestos
            </h1>
            <p className="text-gray-600 dark:text-slate-400">
                Gestione los pedidos de piezas y visualice las reparaciones de sucursales que dependen de ellos.
            </p>
            
            <div className="border-b border-gray-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`${
                        activeTab === 'orders'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                        } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        Pedidos de Repuestos
                    </button>
                    <button
                        onClick={() => setActiveTab('repairs')}
                        className={`${
                        activeTab === 'repairs'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                        } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                    >
                        Reparaciones en Espera
                    </button>
                </nav>
            </div>

            <div>
                {activeTab === 'orders' && <ManageSpareParts user={user} />}
                {activeTab === 'repairs' && <RepairsWaitingView />}
            </div>
        </div>
    );
};

export default SparePartsView;
