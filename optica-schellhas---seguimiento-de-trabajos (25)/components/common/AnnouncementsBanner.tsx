import React, { useState } from 'react';
import { type Announcement } from '../../types';
import { MegaphoneIcon, XIcon } from './Icons';

export const AnnouncementsBanner: React.FC<{announcements: Announcement[]}> = ({ announcements }) => {
    if (announcements.length === 0) return null;
    const [visible, setVisible] = useState(true);

    if (!visible) return null;

    return (
        <div className="bg-blue-600 text-white sticky top-[81px] z-30">
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <MegaphoneIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                        <p className="text-sm font-medium">{announcements[0].message}</p>
                    </div>
                    <button onClick={() => setVisible(false)} className="p-1 rounded-full hover:bg-blue-500">
                        <XIcon className="h-5 w-5"/>
                    </button>
                </div>
            </div>
        </div>
    )
}
