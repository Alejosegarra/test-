import React from 'react';
import type { Job } from '../../types';
import { Card, CardContent } from './UI';
import { AlertTriangleIcon } from './Icons';

interface OverdueJobsWarningProps {
    jobs: Job[];
    title: string;
    description: string;
    onJobClick: (job: Job) => void;
}

export const OverdueJobsWarning: React.FC<OverdueJobsWarningProps> = ({ jobs, title, description, onJobClick }) => {
    if (jobs.length === 0) {
        return null;
    }

    return (
        <Card className="border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-500 mb-6 animate-fadeIn">
            <CardContent>
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangleIcon className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div className="ml-3">
                        <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200">{title}</h3>
                        <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                            <p>{description}</p>
                            <ul className="list-disc space-y-1 pl-5 mt-2">
                                {jobs.map(job => (
                                    <li key={job.id}>
                                        <button 
                                            onClick={() => onJobClick(job)}
                                            className="font-mono font-semibold hover:underline"
                                        >
                                            #{job.id}
                                        </button>
                                        <span className="text-xs"> (de {job.branch_name})</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
