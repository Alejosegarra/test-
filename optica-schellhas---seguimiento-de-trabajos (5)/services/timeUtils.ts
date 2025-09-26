/**
 * Calculates the number of business hours (Mon-Fri) between a start date and now.
 * @param startDateString The starting date in ISO string format.
 * @returns The total number of business hours passed.
 */
export const calculateBusinessHours = (startDateString: string): number => {
    const startDate = new Date(startDateString);
    const now = new Date();
    
    let hours = 0;
    
    // Use a cursor that increments by the hour
    const cursor = new Date(startDate);

    while (cursor < now) {
        const day = cursor.getDay(); // 0 = Sunday, 6 = Saturday
        if (day !== 0 && day !== 6) {
            hours++;
        }
        cursor.setTime(cursor.getTime() + 1000 * 60 * 60); // Increment by one hour
    }

    return hours;
};
