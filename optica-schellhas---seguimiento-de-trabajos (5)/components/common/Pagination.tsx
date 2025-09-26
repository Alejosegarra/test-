import React from 'react';
import { Button, Select } from './UI';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({ 
    currentPage, 
    totalPages, 
    onPageChange,
    totalItems,
    pageSize,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50]
}) => {
    if (totalPages <= 1 && totalItems <= pageSizeOptions[0]) {
        return null;
    }

    const from = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const to = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 text-sm text-gray-700 dark:text-slate-300 gap-4">
            <div>
                <span>
                    Mostrando {from} - {to} de {totalItems} trabajos
                </span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span>Mostrar:</span>
                    <Select 
                        value={pageSize} 
                        onChange={e => onPageSizeChange(Number(e.target.value))} 
                        className="!w-auto py-1.5"
                        aria-label="Resultados por página"
                    >
                        {pageSizeOptions.map(size => (
                             <option key={size} value={size}>{size}</option>
                        ))}
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="secondary"
                        size="sm"
                    >
                        Anterior
                    </Button>
                    <span>
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        variant="secondary"
                        size="sm"
                    >
                        Siguiente
                    </Button>
                </div>
            </div>
        </div>
    );
};
