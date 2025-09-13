export const isMobileDevice = (): boolean => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        return false; // Default to desktop for SSR
    }

    // Check screen width - consider anything 768px and below as mobile
    const isMobileWidth = window.innerWidth <= 768;

    // Check user agent for mobile devices
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    // Return true if either condition indicates mobile
    return isMobileWidth || isMobileUserAgent;
};


export const getDeviceSpecificRoute = (): string => {
    if (isMobileDevice()) {
        return '/chat/?view=kairoll';
    } else {
        return '/chat?view=split'; // Desktop/tablets go to split view
    }
}; 