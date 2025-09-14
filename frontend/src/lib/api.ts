import axios from 'axios';

// Create axios instance with base URL
// Prefer env value, but fix known misconfigured domains automatically
declare const process: any;
const BAD_TO_GOOD_HOST_MAP: Record<string, string> = {
    'https://kairopublic-production.up.railway.app': 'https://kairo-production-6c0a.up.railway.app',
};

const RAW_ENV_BASE = process?.env?.NEXT_PUBLIC_API_URL as string | undefined;
if (!RAW_ENV_BASE) {
    throw new Error('NEXT_PUBLIC_API_URL not set');
}
const NORMALIZED_ENV_BASE = RAW_ENV_BASE.replace(/\/+$/, '');
const FIXED_BASE = BAD_TO_GOOD_HOST_MAP[NORMALIZED_ENV_BASE] || NORMALIZED_ENV_BASE;
// Normalize by removing any trailing slash to avoid double slashes in requests
const API_BASE_URL = FIXED_BASE.replace(/\/+$/, '');

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 45000, // 45 second timeout for Render cold starts
});

// Types for authentication
export interface LoginCredentials {
    identifier: string; // Can be either email or username
    password: string;
}

export interface SignupCredentials {
    username?: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    program?: string;
}

export interface AuthResponse {
    token: string;  // This is the access token (JWT for some endpoints, Django Token for others)
    refresh?: string;  // JWT refresh token (optional, not used with Django Token auth)
    user?: {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        is_guest?: boolean;
    };
    guest_info?: {
        note: string;
    };
    message?: string; // For guest login response
    funny_message?: string; // For personalized funny messages
}

// Token management functions
export const getToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('token');
    }
    return null;
};

export const setToken = (token: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        // Set token for all future requests with Bearer prefix for JWT
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
};

export const getRefreshToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('refresh_token');
    }
    return null;
};

export const setRefreshToken = (token: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', token);
    }
};

export const removeTokens = (): void => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('funny_message');
        localStorage.removeItem('user_name');
        localStorage.removeItem('is_guest');
        localStorage.removeItem('guest_session_id');
        delete api.defaults.headers.common['Authorization'];
    }
};

// Funny message management
export const getFunnyMessage = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('funny_message');
    }
    return null;
};

export const setFunnyMessage = (message: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('funny_message', message);
    }
};

export const getUserName = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('user_name');
    }
    return null;
};

// Guest flag management
export const setGuestFlag = (value: boolean): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('is_guest', value ? 'true' : 'false');
    }
};

export const isGuest = (): boolean => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('is_guest') === 'true';
    }
    return false;
};

// Guest session id helpers
export const generateGuestSessionId = (): string => {
    try {
        // Prefer crypto if available
        const bytes = new Uint8Array(16);
        if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch {}
    // Fallback
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const setGuestSessionId = (id?: string): string => {
    const sessionId = id || generateGuestSessionId();
    if (typeof window !== 'undefined') {
        localStorage.setItem('guest_session_id', sessionId);
    }
    return sessionId;
};

export const getGuestSessionId = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('guest_session_id');
    }
    return null;
};

export const setUserName = (name: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('user_name', name);
    }
};

// Initialize token on app load
export const initializeAuth = (): void => {
    const token = getToken();
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
};

// Add request interceptor to ensure token is set for all requests
api.interceptors.request.use(
    (config: any) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: any) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
    (response: any) => {
        return response;
    },
    async (error: any) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Check if we have a refresh token
            const refreshToken = getRefreshToken();
        if (refreshToken) {
                try {
                    
                    const response = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
                        refresh: refreshToken
                    });

                    const newToken = response.data.access;
                    setToken(newToken);

                    // Retry the original request with the new token
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Remove invalid tokens and redirect to login
                    removeTokens();
                    if (typeof window !== 'undefined') {
                        window.location.href = '/login';
                    }
                    return Promise.reject(refreshError);
                }
            } else {
                // No refresh token available, redirect to login
                removeTokens();
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);

// Authentication API functions
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
        // Validate input before sending request
        if (!credentials.identifier || !credentials.password) {
            throw new Error('Email/Username and password are required');
        }

        // Custom login view expects identifier (email or username) and password
        const loginData = {
            identifier: credentials.identifier,
            password: credentials.password
        };

        

        const response = await api.post('/api/auth/login/', loginData);
        const data = response.data;

        

        // Django Token auth returns token directly
        const authResponse: AuthResponse = {
            token: data.token,
            ...(data.refresh && { refresh: data.refresh }), // Only include refresh if it exists
            user: data.user || {
                id: 0,
                email: credentials.identifier, // Use identifier (could be email or username)
                first_name: '',
                last_name: ''
            }
        };

        // Store token
        setToken(authResponse.token);
        // Store refresh token if available
        if (authResponse.refresh) {
            setRefreshToken(authResponse.refresh);
        }

        // Normal login -> ensure guest flag is false
        setGuestFlag(false);

        // Store funny message and user name if provided
        if (data.funny_message) {
            setFunnyMessage(data.funny_message);
        }
        if (data.user?.first_name) {
            setUserName(data.user.first_name);
        } else if (data.user?.username) {
            setUserName(data.user.username);
        }

        return authResponse;
    } catch (error) {
        
        console.error('Raw error:', error);

        if (axios.isAxiosError(error)) {
            

            const status = error.response?.status;
            const data = error.response?.data;

            let errorMessage = 'Login failed';

            if (status === 400) {
                if (!data || Object.keys(data).length === 0) {
                    errorMessage = 'Bad request - server returned no error details';
                } else if (data.detail) {
                    errorMessage = data.detail;
                } else if (data.non_field_errors) {
                    errorMessage = data.non_field_errors[0];
                } else {
                    errorMessage = `Bad request: ${JSON.stringify(data)}`;
                }
            } else if (status === 401 && data?.error) {
                // Backend returns { error: 'Incorrect password' }
                errorMessage = data.error;
            } else if (status === 404 && data?.error) {
                // Backend returns { error: 'Account not found' }
                errorMessage = data.error;
            } else if (data?.detail) {
                errorMessage = data.detail;
            }

            throw new Error(errorMessage);
        }

        throw new Error('Login failed - network error');
    }
};

export const signup = async (credentials: SignupCredentials): Promise<AuthResponse> => {
    try {
        // Validate input before sending request
        if (!credentials.email || !credentials.password) {
            throw new Error('Email and password are required');
        }

        

        // Format data for Django registration endpoint
        const signupData = {
            email: credentials.email,
            password: credentials.password,
            username: credentials.username || '',
            first_name: credentials.first_name || '',
            last_name: credentials.last_name || '',
            program: credentials.program || ''
        };

        const response = await api.post('/api/auth/register/', signupData);
        

        // Store funny message and user name from registration response
        if (response.data.funny_message) {
            setFunnyMessage(response.data.funny_message);
        }
        if (response.data.user?.first_name) {
            setUserName(response.data.user.first_name);
        } else if (response.data.user?.username) {
            setUserName(response.data.user.username);
        }

        // After successful registration, automatically log in
        const loginCredentials: LoginCredentials = {
            identifier: credentials.email, // Use email for login after signup
            password: credentials.password
        };

        return await login(loginCredentials);

    } catch (error) {
        console.error('Signup error:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response status:', error.response?.status);
            console.error('Response data:', error.response?.data);

            // Handle Django validation errors
            const errorData = error.response?.data;
            let errorMessage = 'Signup failed';

            if (errorData) {
                if (errorData.username) {
                    errorMessage = `Username: ${errorData.username[0]}`;
                } else if (errorData.email) {
                    errorMessage = `Email: ${errorData.email[0]}`;
                } else if (errorData.password) {
                    errorMessage = `Password: ${errorData.password[0]}`;
                } else if (errorData.error) {
                    errorMessage = errorData.error;
                } else if (errorData.detail) {
                    errorMessage = errorData.detail;
                }
            }

            throw new Error(errorMessage);
        }
        throw new Error('An unexpected error occurred');
    }
};

export const guestLogin = async (): Promise<AuthResponse> => {
    try {
        

        // Clear any existing tokens before guest login to prevent sending invalid tokens
        
        removeTokens();

        // Use extended timeout for guest login due to Render cold starts
        const response = await api.post('/api/auth/guest-login/', {}, {
            timeout: 60000 // 60 second timeout specifically for guest login
        });

        

        const data: AuthResponse = response.data;

        

        // Store access token
        setToken(data.token);

        // Store refresh token if needed
        if (data.refresh) {
            setRefreshToken(data.refresh);
        } else {
            
        }
        // Mark as guest
        setGuestFlag(true);
        setGuestSessionId();
        return data;
    } catch (error) {
        
        console.error('Guest login error:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response status:', error.response?.status);
            console.error('Response headers:', error.response?.headers);
            console.error('Response data:', error.response?.data);
            console.error('Request URL:', error.config?.url);
            console.error('Request method:', error.config?.method);
            console.error('Request headers:', error.config?.headers);
            const errorMessage = error.response?.data?.detail || `HTTP ${error.response?.status}: Guest login failed`;
            throw new Error(errorMessage);
        }
        throw new Error('An unexpected error occurred');
    }
};

export const logout = (): void => {
    // Clear all tokens and guest flag
    removeTokens();
    setGuestFlag(false);
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
    const token = getToken();
    return !!token;
};

// Interface for CalendarEvent
export interface CalendarEvent {
    id?: number; // Optional, but good to have
    title: string;
    day_of_week?: string; // For recurring weekly events
    start_time: string; // "HH:MM"
    end_time: string;   // "HH:MM"
    start_date?: string; // "YYYY-MM-DD" for specific date events
    end_date?: string;   // "YYYY-MM-DD" for specific date events
    description?: string; // Optional description
    professor?: string;   // Professor name field
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none'; // Recurrence pattern
    reference_date?: string; // Reference date for bi-weekly calculation
    theme?: string; // Event color theme
}

// Function to get calendar events
export const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
    try {
        

        const response = await api.get('/api/calendar/events/');

        

        return response.data as CalendarEvent[];
    } catch (error) {
        
        console.error('Raw error:', error);

        if (axios.isAxiosError(error)) {
            

            // Check if it's an authentication error
            if (error.response?.status === 401) {
                console.error('Authentication failed - user may need to log in again');
            } else if (error.response?.status === 403) {
                console.error('Permission denied - user may not have access to calendar events');
            }

            console.error('Error fetching calendar events:', error.response?.data);
        } else {
            console.error('Unexpected error fetching calendar events:', error);
        }
        return []; // Return empty array on error to prevent crashes
    }
};

// Function to create a calendar event
export const createCalendarEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    try {
        

        // Check if user is authenticated
        if (!getToken()) {
            throw new Error('Authentication required. Please log in to create events.');
        }

        // Validate required fields
        if (!event.title?.trim()) {
            throw new Error('Event title is required');
        }
        if (!event.start_time || !event.end_time) {
            throw new Error('Start time and end time are required');
        }

        // Ensure proper field mapping for API
        const eventPayload = {
            title: event.title.trim(),
            start_time: event.start_time,
            end_time: event.end_time,
            day_of_week: event.day_of_week || null,
            start_date: event.start_date || null,
            end_date: event.end_date || null,
            description: event.description || '',
            professor: event.professor || '',
            recurrence_pattern: event.recurrence_pattern || 'weekly',
            reference_date: event.reference_date || null,
            theme: event.theme || 'lavender-peach'
        };

        

        const response = await api.post('/api/calendar/events/', eventPayload);
        

        return response.data;
    } catch (error) {
        
        console.error('Raw error:', error);

        if (axios.isAxiosError(error)) {
            

            // Provide specific error messages based on status code
            if (error.response?.status === 404) {
                throw new Error('Calendar API endpoint not found. Please check if the backend is running at the correct URL.');
            } else if (error.response?.status === 403) {
                throw new Error('Permission denied. You may not have access to create calendar events.');
            } else if (error.response?.status === 401) {
                throw new Error('Authentication failed. Please log out and log back in.');
            } else if (error.response?.status === 400) {
                const errorData = error.response.data;
                console.error('Validation errors from server:', errorData);
                if (typeof errorData === 'object' && errorData !== null) {
                    const errorMessages = Object.entries(errorData).map(([field, messages]) => {
                        const messageText = Array.isArray(messages) ? messages.join(', ') : String(messages);
                        return `${field}: ${messageText}`;
                    }).join('; ');
                    throw new Error(`Validation error: ${errorMessages}`);
                } else {
                    throw new Error(error.response?.data?.detail || 'Bad request - invalid event data');
                }
            } else if (error.response?.status === 500) {
                throw new Error('Server error. Please try again later or contact support.');
            } else if (!error.response) {
                // Network error
                throw new Error(`Network error: Unable to connect to ${API_BASE_URL}. Please check if the backend is running.`);
            } else {
                throw new Error(error.response?.data?.detail || error.response?.data?.error || `Server error (${error.response?.status})`);
            }
        } else {
            // Non-Axios error
            throw new Error(error instanceof Error ? error.message : 'An unexpected error occurred while creating the event');
        }
    }
};

// Function to delete a calendar event
export const deleteCalendarEvent = async (eventId: number): Promise<void> => {
    try {
        

        const response = await api.delete(`/api/calendar/events/${eventId}/`);
        

        if (response.status !== 204) {
            throw new Error(`Failed to delete calendar event: ${response.status}`);
        }
    } catch (error: any) {
        
        console.error('Delete error:', error);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);

            if (error.response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            } else if (error.response.status === 403) {
                throw new Error('You do not have permission to delete this event.');
            } else if (error.response.status === 404) {
                throw new Error('Event not found. It may have been already deleted.');
            } else {
                throw new Error(error.response.data?.detail || error.response.data?.error || 'Failed to delete calendar event');
            }
        } else if (error.request) {
            throw new Error('Network error. Please check your internet connection.');
        } else {
            throw new Error(error.message || 'An unexpected error occurred while deleting the event');
        }
    }
};

// Function to update a calendar event
export const updateCalendarEvent = async (eventId: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    try {
        

        // Use PATCH and remove undefined fields to avoid wiping values unintentionally
        const payload: Record<string, any> = {};
        Object.entries(event).forEach(([key, value]) => {
            if (value !== undefined) payload[key] = value;
        });
        

        const response = await api.patch(`/api/calendar/events/${eventId}/`, payload);
        

        if (response.status !== 200) {
            throw new Error(`Failed to update calendar event: ${response.status}`);
        }

        return response.data;
    } catch (error: any) {
        console.error('=== UPDATE CALENDAR EVENT ERROR DEBUG ===');
        console.error('Update error:', error);
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);

            if (error.response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            } else if (error.response.status === 403) {
                throw new Error('You do not have permission to update this event.');
            } else if (error.response.status === 404) {
                throw new Error('Event not found. It may have been deleted.');
            } else if (error.response.status === 400) {
                const errorData = error.response.data;
                if (errorData && typeof errorData === 'object') {
                    const errorMessages = Object.entries(errorData)
                        .map(([field, messages]: [string, any]) => {
                            if (Array.isArray(messages)) {
                                return `${field}: ${messages.join(', ')}`;
                            }
                            return `${field}: ${messages}`;
                        })
                        .join('; ');
                    throw new Error(`Validation error: ${errorMessages}`);
                }
                throw new Error('Invalid event data provided');
            } else {
                throw new Error(error.response.data?.detail || error.response.data?.error || 'Failed to update calendar event');
            }
        } else if (error.request) {
            throw new Error('Network error. Please check your internet connection.');
        } else {
            throw new Error(error.message || 'An unexpected error occurred while updating the event');
        }
    }
};

// Function to parse AI response and create calendar events if JSON is found
export const parseAndCreateCalendarEvents = async (aiResponse: string): Promise<CalendarEvent[]> => {
    const createdEvents: CalendarEvent[] = [];

    try {
        // First, look for JSON objects in code blocks
        const jsonPattern = /```json\s*([\s\S]*?)\s*```/g;
        let match;

        while ((match = jsonPattern.exec(aiResponse)) !== null) {
            try {
                const jsonData = JSON.parse(match[1]);

                // Check if it's a calendar event creation request
                if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                    const params = jsonData.params;

                    // Handle multiple days
                    const days = Array.isArray(params.day_of_week) ? params.day_of_week : [params.day_of_week];

                    for (const day of days) {
                        const eventData = {
                            title: params.title,
                            day_of_week: day,
                            start_time: params.start_time,
                            end_time: params.end_time
                        };

                        const createdEvent = await createCalendarEvent(eventData);
                        createdEvents.push(createdEvent);
                    }
                }
            } catch (parseError) {
                console.warn('Failed to parse JSON from code block:', parseError);
            }
        }

        // If no code blocks found, look for plain JSON objects
        if (createdEvents.length === 0) {
            // Look for JSON objects that might be standalone
            const plainJsonPattern = /\{[^}]*"action"\s*:\s*"create_calendar_event"[^}]*\}/g;
            let plainMatch;

            while ((plainMatch = plainJsonPattern.exec(aiResponse)) !== null) {
                try {
                    const jsonData = JSON.parse(plainMatch[0]);

                    if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                        const params = jsonData.params;

                        // Handle multiple days
                        const days = Array.isArray(params.day_of_week) ? params.day_of_week : [params.day_of_week];

                        for (const day of days) {
                            const eventData = {
                                title: params.title,
                                day_of_week: day,
                                start_time: params.start_time,
                                end_time: params.end_time
                            };

                            const createdEvent = await createCalendarEvent(eventData);
                            createdEvents.push(createdEvent);
                        }
                    }
                } catch (parseError) {
                    console.warn('Failed to parse plain JSON:', parseError);
                }
            }
        }

        // Additional fallback: try to parse the entire response as JSON if it looks like one
        if (createdEvents.length === 0 && aiResponse.trim().startsWith('{') && aiResponse.trim().endsWith('}')) {
            try {
                const jsonData = JSON.parse(aiResponse.trim());
                if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                    const params = jsonData.params;

                    // Handle multiple days
                    const days = Array.isArray(params.day_of_week) ? params.day_of_week : [params.day_of_week];

                    for (const day of days) {
                        const eventData = {
                            title: params.title,
                            day_of_week: day,
                            start_time: params.start_time,
                            end_time: params.end_time
                        };

                        const createdEvent = await createCalendarEvent(eventData);
                        createdEvents.push(createdEvent);
                    }
                }
            } catch (parseError) {
                console.warn('Failed to parse entire response as JSON:', parseError);
            }
        }
    } catch (error) {
        console.error('Error parsing AI response for calendar events:', error);
    }

    return createdEvents;
};

// Export the configured axios instance for other API calls
export default api; 