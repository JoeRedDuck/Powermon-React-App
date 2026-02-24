import { createContext, useContext } from 'react';

const AuthContext = createContext({
  logout: () => {},
  deleteAccount: () => {},
});

export const AuthProvider = AuthContext.Provider;

export function useAuth() {
  return useContext(AuthContext);
}
