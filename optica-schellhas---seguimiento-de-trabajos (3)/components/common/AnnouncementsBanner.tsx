import React, { useState, useEffect } from 'react';
import { type Announcement } from '../../types';
import { MegaphoneIcon, XIcon } from './Icons';

export const AnnouncementsBanner: React.FC<{announcements: Announcement[]}> = ({ announcements }) => {
    const [visible, setVisible] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused || announcements.length <= 1) {
            return; // Don't start the timer if paused or only one announcement
        }

        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % announcements.length);
        }, 8000); // Change announcement every 8 seconds

        return () => clearInterval(timer); // Cleanup the interval on component unmount or when dependencies change
    }, [currentIndex, isPaused, announcements.length]);
    
    const goToAnnouncement = (index: number) => {
        setCurrentIndex(index);
    }

    if (announcements.length === 0 || !visible) return null;
    
    const currentAnnouncement = announcements[currentIndex];
    // A simple heuristic for long messages that might need to scroll.
    const isLongMessage = currentAnnouncement.message.length > 80;

    return (
        <div 
            className="bg-amber-400 text-amber-900 dark:bg-teal-800 dark:text-teal-100 sticky top-[81px] z-30"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            role="region"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Anuncios importantes"
        >
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-between">
                    {/* The container for the message needs to hide the overflow for the marquee to work */}
                    <div className="flex items-center flex-grow overflow-hidden mr-4">
                        <MegaphoneIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                        {/* Use key to re-trigger animation on change */}
                        <div key={currentIndex} className={`animate-fadeIn ${isLongMessage ? 'whitespace-nowrap' : 'w-full'}`}>
                             <p className={`text-sm font-medium ${isLongMessage ? 'inline-block animate-marquee' : 'truncate'}`}>
                                {currentAnnouncement.message}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        {announcements.length > 1 && (
                            <div className="flex items-center space-x-2 mr-2" role="tablist" aria-label="Navegación de anuncios">
                                {announcements.map((_, index) => (
                                    <button 
                                        key={index}
                                        onClick={() => goToAnnouncement(index)}
                                        className={`h-2 w-2 rounded-full transition-colors ${currentIndex === index ? 'bg-amber-800 dark:bg-teal-50' : 'bg-amber-600 dark:bg-teal-300 hover:bg-amber-700 dark:hover:bg-teal-200'}`}
                                        aria-label={`Ir al anuncio ${index + 1}`}
                                        role="tab"
                                        aria-selected={currentIndex === index}
                                    />
                                ))}
                            </div>
                        )}
                        <button onClick={() => setVisible(false)} className="p-1 rounded-full hover:bg-amber-500 dark:hover:bg-teal-700" aria-label="Cerrar anuncios">
                            <XIcon className="h-5 w-5"/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}