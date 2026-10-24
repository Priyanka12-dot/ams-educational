import { create } from "zustand";
interface SessionState {
  authenticated: boolean;
  setAuthenticated(value: boolean): void;
}
/** In-memory UI session flag; the credential remains only in HttpOnly server cookies. */
export const useSessionStore = create<SessionState>((set) => ({
  authenticated: false,
  setAuthenticated: (value) => set({ authenticated: value }),
}));
