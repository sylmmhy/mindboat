import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  autoClose?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Convenience methods
  showSuccess: (message: string, title?: string, options?: Partial<Notification>) => void;
  showError: (message: string, title?: string, options?: Partial<Notification>) => void;
  showWarning: (message: string, title?: string, options?: Partial<Notification>) => void;
  showInfo: (message: string, title?: string, options?: Partial<Notification>) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      id,
      autoClose: true,
      duration: 5000,
      ...notification,
    };

    set(state => ({
      notifications: [...state.notifications, newNotification]
    }));

    // Auto-remove if autoClose is enabled
    if (newNotification.autoClose) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }
  },

  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  },

  showSuccess: (message, title, options = {}) => {
    get().addNotification({
      type: 'success',
      title,
      message,
      ...options,
    });
  },

  showError: (message, title, options = {}) => {
    get().addNotification({
      type: 'error',
      title,
      message,
      autoClose: false, // Errors should be manually dismissed
      ...options,
    });
  },

  showWarning: (message, title, options = {}) => {
    get().addNotification({
      type: 'warning',
      title,
      message,
      duration: 7000, // Warnings stay a bit longer
      ...options,
    });
  },

  showInfo: (message, title, options = {}) => {
    get().addNotification({
      type: 'info',
      title,
      message,
      ...options,
    });
  },
}));