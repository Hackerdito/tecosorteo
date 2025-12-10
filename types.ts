export interface User {
  name: string;
  password?: string; // Optional because legacy data might just be strings, but new system uses this
  isAdmin?: boolean;
}

export interface Assignment {
  giver: string;
  receiver: string;
}

export interface AppState {
  users: User[]; // Now stores objects instead of just strings
  assignments: Assignment[];
  isDrawComplete: boolean;
}

export enum AppStatus {
  LOGIN = 'LOGIN',
  LOBBY = 'LOBBY',
  RESULT = 'RESULT'
}
