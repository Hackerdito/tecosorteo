import React, { useState, useEffect } from 'react';
import { AppState, AppStatus, User } from './types';
import { ADMIN_NAME, ADMIN_PASSWORD, TARGET_PARTICIPANTS } from './constants';
import * as StorageService from './services/storageService';
import * as GeminiService from './services/geminiService';
import { Button } from './components/Button';
import { AlertCircle, Gift, Users, Snowflake, LogOut, CheckCircle2, Trash2, Loader2, Database, ExternalLink, Lock } from 'lucide-react';

const App: React.FC = () => {
  const [currentName, setCurrentName] = useState<string>('');
  const [inputName, setInputName] = useState<string>('');
  const [inputPassword, setInputPassword] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.LOGIN);
  
  const [appState, setAppState] = useState<AppState>({ users: [], assignments: [], isDrawComplete: false });
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const [error, setError] = useState<string>('');
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  
  // Track specific deletion loading state
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  // Subscribe to Firebase changes
  useEffect(() => {
    const unsubscribe = StorageService.subscribeToState(
      (newState) => {
        setAppState(newState);
        setIsDataLoaded(true);
        setConnectionError(null);
        
        // Auto-redirect logic based on global state
        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
           // If draw is complete, move to result automatically
           if (newState.isDrawComplete) {
              setStatus(AppStatus.RESULT);
           } 
           // If admin resets, move back to lobby
           else if (status === AppStatus.RESULT && !newState.isDrawComplete) {
              setStatus(AppStatus.LOBBY);
              setAiMessage('');
           }
        }
      },
      (err) => {
        console.error("Connection error in App:", err);
        // Robust error checking for common Firebase setup issues
        const msg = err.message || "";
        if (
             msg.includes("Cloud Firestore API has not been used") || 
             msg.includes("permission-denied") ||
             msg.includes("not-found") ||
             msg.includes("does not exist")
        ) {
           setConnectionError("setup_needed");
        } else {
           setConnectionError(msg || "Error de conexión desconocido");
        }
        setIsDataLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [status]);

  // Initial Login Check
  useEffect(() => {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser && isDataLoaded && !connectionError) {
      setCurrentName(storedUser);
      // Determine correct screen
      if (appState.isDrawComplete) {
        setStatus(AppStatus.RESULT);
        fetchAiMessage(appState, storedUser);
      } else {
        setStatus(AppStatus.LOBBY);
      }
    }
  }, [isDataLoaded, appState.isDrawComplete, connectionError]);

  const isAdmin = currentName === ADMIN_NAME;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsActionLoading(true);

    const rawName = inputName.trim();
    const rawPass = inputPassword.trim();

    if (!rawName || !rawPass) {
      setError('Nombre y contraseña obligatorios.');
      setIsActionLoading(false);
      return;
    }

    const normalizedName = StorageService.normalizeName(rawName);

    // Special Admin Check
    if (normalizedName === ADMIN_NAME) {
      if (rawPass !== ADMIN_PASSWORD) {
        setError('Contraseña de administrador incorrecta.');
        setIsActionLoading(false);
        return;
      }
    }

    // Call Service
    const result = await StorageService.registerUser(normalizedName, rawPass);
    
    if (result === 'SUCCESS') {
        sessionStorage.setItem('currentUser', normalizedName);
        setCurrentName(normalizedName);
        if (appState.isDrawComplete) {
            setStatus(AppStatus.RESULT);
            fetchAiMessage(appState, normalizedName);
        } else {
            setStatus(AppStatus.LOBBY);
        }
    } else if (result === 'WRONG_PASSWORD') {
        setError('Ese nombre ya existe y la contraseña no coincide.');
    } else if (result === 'GAME_CLOSED') {
        setError('El sorteo ya ha comenzado, no se admiten nuevos registros.');
    } else {
        setError('Error de conexión. Intenta de nuevo.');
    }

    setIsActionLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    setCurrentName('');
    setInputName('');
    setInputPassword('');
    setAiMessage('');
    setStatus(AppStatus.LOGIN);
  };

  const handleRemoveUser = async (userToRemove: string) => {
    if (confirm(`¿Eliminar a ${userToRemove} de la lista?`)) {
      setDeletingUser(userToRemove);
      try {
        await StorageService.removeUser(userToRemove);
      } catch (e) {
        alert("Hubo un error al eliminar. Intenta de nuevo.");
      } finally {
        setDeletingUser(null);
      }
    }
  };

  const handleDraw = async () => {
    if (appState.users.length < 2) {
      setError('Se necesitan al menos 2 personas para el sorteo.');
      return;
    }
    if (confirm("¿Estás seguro? Esto cerrará el registro y asignará los regalos.")) {
        setIsActionLoading(true);
        await StorageService.performDraw();
        setIsActionLoading(false);
    }
  };

  const fetchAiMessage = async (state: AppState, user: string) => {
    const receiver = StorageService.getAssignmentFromState(state, user);
    if (receiver && !aiMessage) {
      setIsLoadingAi(true);
      const msg = await GeminiService.generateGiftHint(receiver);
      setAiMessage(msg);
      setIsLoadingAi(false);
    }
  };

  const handleReset = async () => {
    if (confirm("⚠️ ¿PELIGRO: Estás seguro? Esto borrará a TODOS los participantes y reiniciará la app.")) {
      await StorageService.resetApp();
      handleLogout();
    }
  };

  // --- RENDER HELPERS ---

  if (connectionError === "setup_needed") {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-red-500 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="bg-red-500/20 p-4 rounded-full">
                        <Database className="w-12 h-12 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">¡Falta un paso final!</h2>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        La conexión con Firebase es correcta, pero la <strong>Base de Datos (Firestore)</strong> aún no existe en tu proyecto.
                    </p>
                    
                    <div className="bg-slate-800 p-4 rounded-lg text-left text-sm space-y-3 w-full border border-slate-700">
                        <p className="font-semibold text-white">Cómo solucionarlo (1 minuto):</p>
                        <ol className="list-decimal list-inside text-slate-400 space-y-2">
                            <li>Haz clic en el botón de abajo.</li>
                            <li>En el menú lateral, busca <strong>"Firestore Database"</strong>.</li>
                            <li>Haz clic en <strong>"Create Database"</strong>.</li>
                            <li>Selecciona ubicación (us-central1 está bien).</li>
                            <li>Importante: Selecciona <strong>"Start in Test Mode"</strong>.</li>
                        </ol>
                    </div>

                    <a 
                        href="https://console.firebase.google.com/project/navidad-30d2c/firestore" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all w-full justify-center"
                    >
                        Ir a Consola Firebase <ExternalLink className="w-4 h-4" />
                    </a>
                    
                    <button 
                        onClick={() => window.location.reload()}
                        className="text-xs text-slate-500 hover:text-white mt-4 underline"
                    >
                        Ya la creé, recargar página
                    </button>
                </div>
            </div>
        </div>
      );
  }

  if (!isDataLoaded) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white">
                <Loader2 className="w-10 h-10 animate-spin text-red-500" />
                <p>Cargando Polo Norte...</p>
            </div>
        </div>
    );
  }

  const renderLogin = () => (
    <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="font-christmas text-5xl text-red-400 mb-2 drop-shadow-lg">Intercambio</h1>
        <h2 className="text-xl font-light tracking-widest text-emerald-200">NAVIDAD 2025</h2>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Tu Nombre y Apellido</label>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-slate-500 transition-all"
            placeholder="Ej. Juan Perez"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Crea tu Contraseña</label>
          <div className="relative">
            <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="w-full pl-10 px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-slate-500 transition-all"
                placeholder="Secreta..."
            />
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            * Si es tu primera vez, esta será tu contraseña. Si ya te registraste, úsala para entrar.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-300 text-sm bg-red-900/30 p-3 rounded-lg border border-red-800/50">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" isLoading={isActionLoading}>
          {appState.users.find(u => u.name === StorageService.normalizeName(inputName)) ? "Entrar" : "Registrarme"}
        </Button>
      </form>
    </div>
  );

  const renderLobby = () => {
    // Only Admin can draw
    const canForceDraw = appState.users.length >= 2; 

    return (
      <div className="w-full max-w-2xl p-6 md:p-10 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-6">
        <header className="flex justify-between items-center pb-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Sala de Espera</h2>
            <p className="text-slate-400 text-sm">Hola, <span className="text-red-400 font-semibold">{currentName}</span></p>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
          <div className="flex justify-between items-end mb-4">
             <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-400">
              <Users className="w-5 h-5" />
              Participantes ({appState.users.length})
            </h3>
            {isAdmin && (
                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30">Admin Mode</span>
            )}
          </div>
         
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {appState.users.map((user, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 group">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] flex-shrink-0"></div>
                    <span className="truncate text-sm">{user.name}</span>
                    {user.name === currentName && <span className="text-xs text-slate-500 ml-auto flex-shrink-0">(Tú)</span>}
                </div>
                {isAdmin && user.name !== currentName && (
                    <button 
                        onClick={() => handleRemoveUser(user.name)}
                        disabled={deletingUser === user.name}
                        className={`p-1 hover:bg-red-900/50 rounded text-slate-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0 ${deletingUser === user.name ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Eliminar usuario"
                    >
                        {deletingUser === user.name ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                    </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4">
          {/* Logic for Users: They just wait */}
          {!isAdmin && (
             <div className="text-center p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
                 <Snowflake className="w-8 h-8 text-emerald-400 mx-auto mb-3 animate-spin-slow" />
                 <h3 className="text-white font-semibold mb-1">Esperando al Administrador</h3>
                 <p className="text-slate-400 text-sm">
                    Gerardo activará el sorteo cuando todos estén listos. 
                    Esta pantalla cambiará automáticamente.
                 </p>
             </div>
          )}

          {/* Logic for Admin: They have the button */}
          {isAdmin && (
             <div className="p-4 bg-red-900/10 border border-red-500/30 rounded-xl space-y-4">
                 <p className="text-sm text-red-200 text-center">
                    Como administrador, tú decides cuándo cerrar el registro y sortear.
                 </p>
                 <Button 
                    onClick={handleDraw} 
                    disabled={!canForceDraw} 
                    isLoading={isActionLoading}
                 >
                    <Gift className="w-5 h-5" />
                    ACTIVAR SORTEO PARA TODOS
                 </Button>
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    const receiver = StorageService.getAssignmentFromState(appState, currentName);
    
    if (!receiver) {
        return (
            <div className="p-8 bg-red-900/50 rounded-2xl border border-red-500 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold">Error</h3>
                <p>Hubo un problema. Posiblemente se realizó el sorteo antes de que entraras.</p>
                <Button onClick={handleLogout} className="mt-4" variant="secondary">Salir</Button>
            </div>
        )
    }

    return (
      <div className="w-full max-w-md perspective-1000 animate-fade-in">
        <div className="bg-gradient-to-br from-red-900 via-slate-900 to-slate-900 rounded-[2rem] p-1 border-2 border-amber-500/30 shadow-[0_0_50px_rgba(220,38,38,0.3)]">
           <div className="bg-slate-900 rounded-[1.8rem] p-8 md:p-12 relative overflow-hidden">
             
             {/* Background Effects */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

             <div className="text-center relative z-10">
                <div className="mb-6">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <h3 className="text-slate-400 text-sm tracking-widest uppercase">¡Sorteo Completado!</h3>
                </div>
                
                <h2 className="text-white text-lg mb-4">Te toca regalar a:</h2>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 backdrop-blur-sm transform transition-all hover:scale-105 duration-300">
                    <span className="font-christmas text-4xl md:text-5xl text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)]">
                        {receiver}
                    </span>
                </div>

                {isLoadingAi ? (
                    <div className="h-20 flex flex-col items-center justify-center text-slate-500 text-sm space-y-2 animate-pulse">
                        <Snowflake className="w-5 h-5 animate-spin" />
                        <span>Generando pista mágica...</span>
                    </div>
                ) : (
                    <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-4 mb-8">
                        <p className="font-christmas text-xl text-emerald-100 leading-relaxed italic">
                            "{aiMessage}"
                        </p>
                    </div>
                )}

                <Button onClick={handleLogout} variant="secondary" className="mt-4">
                   <LogOut className="w-4 h-4" /> Salir
                </Button>
             </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      
      {/* Reset Button (Only for Admin) */}
      {isAdmin && (
        <button 
          onClick={handleReset}
          className="fixed bottom-4 left-4 text-xs text-slate-700 hover:text-red-500 transition-colors z-50 flex items-center gap-1"
          title="Reset Application Data"
        >
          <Trash2 className="w-3 h-3" /> Reiniciar (Admin)
        </button>
      )}

      {status === AppStatus.LOGIN && renderLogin()}
      {status === AppStatus.LOBBY && renderLobby()}
      {status === AppStatus.RESULT && renderResult()}

    </div>
  );
};

export default App;