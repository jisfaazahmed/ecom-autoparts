// Re-export the Zustand auth store as useAuth for backward compatibility.
// All consumers can keep using: const { user, signIn, role } = useAuth();
export { useAuthStore as useAuth } from '@/store/useAuthStore';
