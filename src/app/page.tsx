"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Leaf,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Shield,
  Truck,
  PlusCircle,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  LogOut,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Users,
  BarChart3,
  Award,
  ArrowRight,
  Zap
} from "lucide-react";

// Types matching Supabase tables
interface AppProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "collector" | "restaurant";
  address?: string;
  phone?: string;
  vehicle?: string;
  status: "active" | "inactive";
  created_at: string;
}

interface PickupRequest {
  id: string;
  restaurant_id: string;
  collector_id: string | null;
  date: string;
  hour: string;
  status: "Pendiente" | "Aprobado" | "En camino" | "Completado" | "Cancelado";
  waste_type: string;
  estimated_weight: number;
  actual_weight: number | null;
  notes: string;
  created_at: string;
}

export default function CicloVerdeApp() {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  
  // Real Database States
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<AppProfile | null>(null);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [allUsers, setAllUsers] = useState<AppProfile[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(false);

  // Auth Forms
  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authRole, setAuthRole] = useState<"restaurant" | "collector">("restaurant");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Pickup Forms
  const [newWasteType, setNewWasteType] = useState("Aceite Usado");
  const [newEstimatedWeight, setNewEstimatedWeight] = useState(10);
  const [newDate, setNewDate] = useState("");
  const [newHour, setNewHour] = useState("14:00 - 16:00");
  const [newNotes, setNewNotes] = useState("");

  // Profile Forms
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  // Modals
  const [assigningPickupId, setAssigningPickupId] = useState<string | null>(null);
  const [assignCollectorId, setAssignCollectorId] = useState("");
  const [completingPickupId, setCompletingPickupId] = useState<string | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState(10);

  useEffect(() => {
    setMounted(true);
    
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchInitialData(session.user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchInitialData(session.user.id);
      } else {
        setCurrentUser(null);
        setPickups([]);
        setAllUsers([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchInitialData = async (userId: string) => {
    setIsLoading(true);
    
    // 1. Fetch current user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
      
    if (profile) {
      setCurrentUser(profile as AppProfile);
      
      // Default tabs based on role
      if (profile.role === "admin") setActiveTab("dashboard");
      else if (profile.role === "collector") setActiveTab("rutas");
      else if (profile.role === "restaurant") setActiveTab("dashboard");
    }

    // 2. Fetch pickups (RLS will automatically filter what they can see)
    const { data: pickupsData } = await supabase
      .from("pickups")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (pickupsData) setPickups(pickupsData as PickupRequest[]);

    // 3. If Admin, fetch all users
    if (profile?.role === "admin") {
      const { data: usersData } = await supabase.from("profiles").select("*");
      if (usersData) setAllUsers(usersData as AppProfile[]);
    }
    
    setIsLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setIsLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            name: authName,
            role: authRole,
          }
        }
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setAuthMessage("¡Registro exitoso! Ya puedes iniciar sesión.");
        setIsLogin(true);
      }
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProfileMessage("");
    
    const updates: any = {};
    if (profileEmail && profileEmail !== session?.user?.email) updates.email = profileEmail;
    if (profilePassword) updates.password = profilePassword;
    
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.auth.updateUser(updates);
      if (error) {
        setProfileMessage("Error: " + error.message);
      } else {
        setProfileMessage("¡Credenciales actualizadas! Si cambiaste tu correo, te llegará un enlace para confirmarlo.");
        setProfilePassword("");
        setProfileEmail("");
      }
    }
    setIsLoading(false);
  };

  // RESTAURANT ACTIONS
  const handleCreatePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsLoading(true);

    const { data, error } = await supabase.from("pickups").insert([
      {
        restaurant_id: currentUser.id,
        date: newDate,
        hour: newHour,
        waste_type: newWasteType,
        estimated_weight: Number(newEstimatedWeight),
        notes: newNotes,
        status: "Pendiente"
      }
    ]).select();

    if (!error && data) {
      setPickups([data[0] as PickupRequest, ...pickups]);
      setNewNotes("");
      setActiveTab("solicitudes");
      alert("¡Solicitud enviada correctamente!");
    } else {
      alert("Error al crear solicitud: " + error?.message);
    }
    setIsLoading(false);
  };

  const handleCancelPickup = async (id: string) => {
    const { error } = await supabase.from("pickups").update({ status: "Cancelado" }).eq("id", id);
    if (!error) {
      setPickups(pickups.map(p => p.id === id ? { ...p, status: "Cancelado" } : p));
    }
  };

  // COLLECTOR ACTIONS
  const handleStartRoute = async (id: string) => {
    const { error } = await supabase.from("pickups").update({ status: "En camino" }).eq("id", id);
    if (!error) {
      setPickups(pickups.map(p => p.id === id ? { ...p, status: "En camino" } : p));
    }
  };

  const handleCompletePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingPickupId) return;

    const { error } = await supabase.from("pickups").update({
      status: "Completado",
      actual_weight: actualWeightInput
    }).eq("id", completingPickupId);

    if (!error) {
      setPickups(pickups.map(p => p.id === completingPickupId ? { 
        ...p, 
        status: "Completado", 
        actual_weight: actualWeightInput 
      } : p));
      setCompletingPickupId(null);
    }
  };

  // ADMIN ACTIONS
  const handleAssignCollectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningPickupId || !assignCollectorId) return;

    const { error } = await supabase.from("pickups").update({
      status: "Aprobado",
      collector_id: assignCollectorId
    }).eq("id", assigningPickupId);

    if (!error) {
      setPickups(pickups.map(p => p.id === assigningPickupId ? {
        ...p,
        status: "Aprobado",
        collector_id: assignCollectorId
      } : p));
      setAssigningPickupId(null);
    }
  };

  const getCollectorName = (collectorId: string | null) => {
    if (!collectorId) return "No asignado";
    const coll = allUsers.find(u => u.id === collectorId);
    return coll ? coll.name : "Recolector";
  };
  
  const getRestaurantName = (restId: string) => {
    const rest = allUsers.find(u => u.id === restId);
    return rest ? rest.name : "Restaurante";
  };

  if (!mounted) return null;

  // -----------------------------------------------------
  // LOGIN / REGISTER SCREEN
  // -----------------------------------------------------
  if (!session || !currentUser) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-4 relative bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(10, 15, 10, 0.85), rgba(5, 10, 5, 0.95)), url('/background.png')` }}
      >
        <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 items-center">
          
          <div className="md:col-span-6 flex flex-col justify-center text-left text-white px-4">
            <div className="flex items-center gap-3 mb-6">
              <img src="/CicloVerde.jpeg" alt="Ciclo Verde Logo" className="w-16 h-16 rounded-2xl shadow-xl border-2 border-emerald-500/30 object-cover" />
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                Ciclo Verde
              </h1>
            </div>
            <p className="text-emerald-100/70 text-lg mb-8 leading-relaxed">
              Plataforma digital para la gestión eficiente y sostenible de residuos valorizables entre restaurantes y redes de recolectores autorizados.
            </p>
            
            <div className="space-y-4 hidden md:block">
              <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                <Leaf className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-semibold text-emerald-300">Restaurantes</h3>
                  <p className="text-xs text-white/60">Solicitan recolecciones rápidas, registran residuos y miden su impacto ecológico diario.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                <Truck className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-300">Recolectores</h3>
                  <p className="text-xs text-white/60">Gestionan sus rutas diarias asignadas, navegan a destinos y registran el peso real recolectado.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 bg-zinc-950/90 border border-emerald-900/30 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex justify-center mb-6 border-b border-zinc-800 pb-2">
              <button 
                onClick={() => setIsLogin(true)} 
                className={`flex-1 pb-2 font-bold transition-colors ${isLogin ? "text-emerald-400 border-b-2 border-emerald-500" : "text-zinc-500"}`}
              >
                Ingresar
              </button>
              <button 
                onClick={() => setIsLogin(false)} 
                className={`flex-1 pb-2 font-bold transition-colors ${!isLogin ? "text-emerald-400 border-b-2 border-emerald-500" : "text-zinc-500"}`}
              >
                Crear Cuenta
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">Nombre Comercial o Personal</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">Tipo de Cuenta</label>
                    <select
                      value={authRole}
                      onChange={(e) => setAuthRole(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500"
                    >
                      <option value="restaurant">Soy un Restaurante / Local</option>
                      <option value="collector">Soy un Recolector</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase mb-1">Contraseña</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500"
                  required
                />
              </div>

              {authError && (
                <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{authError}</span>
                </div>
              )}
              
              {authMessage && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-emerald-200 text-xs">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /><span>{authMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {isLoading ? "Procesando..." : (isLogin ? "Iniciar Sesión" : "Registrarse")}
              </button>
              
              <div className="mt-6 border-t border-zinc-800 pt-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continuar con Google
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------
  // MAIN APP DASHBOARD
  // -----------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-zinc-900 flex items-center gap-3">
            <img src="/CicloVerde.jpeg" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-lg text-white">Ciclo Verde</span>
          </div>

          <div className="p-4 border-b border-zinc-900 bg-zinc-900/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-sm text-white truncate">{currentUser.name}</h4>
                <p className="text-xs text-zinc-500 capitalize">{currentUser.role === "restaurant" ? "Restaurante" : currentUser.role === "collector" ? "Recolector" : "Admin"}</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {currentUser.role === "restaurant" && (
              <>
                <button onClick={() => setActiveTab("dashboard")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "dashboard" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-900"}`}><BarChart3 className="w-4 h-4"/> Mi Impacto</button>
                <button onClick={() => setActiveTab("nuevo")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "nuevo" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-900"}`}><PlusCircle className="w-4 h-4"/> Programar Retiro</button>
                <button onClick={() => setActiveTab("solicitudes")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "solicitudes" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-900"}`}><FileText className="w-4 h-4"/> Mis Solicitudes</button>
                <button onClick={() => setActiveTab("perfil")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "perfil" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}><Shield className="w-4 h-4"/> Mi Perfil</button>
              </>
            )}

            {currentUser.role === "collector" && (
              <>
                <button onClick={() => setActiveTab("rutas")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "rutas" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:bg-zinc-900"}`}><Truck className="w-4 h-4"/> Rutas Asignadas</button>
                <button onClick={() => setActiveTab("historial")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "historial" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:bg-zinc-900"}`}><FileText className="w-4 h-4"/> Historial Completado</button>
                <button onClick={() => setActiveTab("perfil")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "perfil" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}><Shield className="w-4 h-4"/> Mi Perfil</button>
              </>
            )}

            {currentUser.role === "admin" && (
              <>
                <button onClick={() => setActiveTab("dashboard")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "dashboard" ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:bg-zinc-900"}`}><BarChart3 className="w-4 h-4"/> Global</button>
                <button onClick={() => setActiveTab("solicitudes")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "solicitudes" ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:bg-zinc-900"}`}><FileText className="w-4 h-4"/> Gestión Recolecciones</button>
                <button onClick={() => setActiveTab("perfil")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "perfil" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}><Shield className="w-4 h-4"/> Mi Perfil</button>
              </>
            )}
          </nav>
        </div>
        
        <div className="p-4 border-t border-zinc-900">
          <button onClick={handleLogout} className="w-full text-zinc-400 hover:text-white hover:bg-red-950/20 py-2 rounded-lg text-sm flex items-center gap-2"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-zinc-950 flex flex-col h-screen overflow-y-auto relative">
        <header className="p-6 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-sm shrink-0">
          <h1 className="text-2xl font-bold text-white capitalize">{activeTab.replace('-', ' ')}</h1>
        </header>

        <div className="p-6 flex-grow">
          {/* ================================== RESTAURANTE ================================== */}
          {currentUser.role === "restaurant" && activeTab === "dashboard" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <span className="text-zinc-400 text-sm">Total Reciclado</span>
                <h3 className="text-3xl font-bold text-emerald-400 mt-2">
                  {pickups.filter(p => p.status === "Completado").reduce((a, b) => a + (b.actual_weight || 0), 0)} Kg
                </h3>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <span className="text-zinc-400 text-sm">CO₂ Evitado Estimado</span>
                <h3 className="text-3xl font-bold text-blue-400 mt-2">
                  {(pickups.filter(p => p.status === "Completado").reduce((a, b) => a + (b.actual_weight || 0), 0) * 1.5).toFixed(1)} Kg
                </h3>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <span className="text-zinc-400 text-sm">Solicitudes Pendientes</span>
                <h3 className="text-3xl font-bold text-yellow-400 mt-2">
                  {pickups.filter(p => p.status === "Pendiente" || p.status === "Aprobado").length}
                </h3>
              </div>
            </div>
          )}

          {currentUser.role === "restaurant" && activeTab === "nuevo" && (
            <div className="max-w-2xl bg-zinc-900/50 border border-zinc-900 p-6 rounded-3xl">
              <h3 className="text-lg font-bold mb-4">Programar Nueva Recolección</h3>
              <form onSubmit={handleCreatePickup} className="space-y-4">
                <select value={newWasteType} onChange={e => setNewWasteType(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white">
                  <option value="Aceite Usado">Aceite Vegetal Usado</option>
                  <option value="Orgánico">Orgánicos</option>
                  <option value="Plásticos">Plásticos</option>
                  <option value="Vidrio">Vidrio</option>
                  <option value="Papel y Cartón">Papel y Cartón</option>
                </select>
                <input type="number" value={newEstimatedWeight} onChange={e => setNewEstimatedWeight(Number(e.target.value))} placeholder="Peso Estimado (Kg)" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white" required />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white" required />
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notas para el recolector" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white" />
                <button type="submit" disabled={isLoading} className="bg-emerald-500 text-black font-bold py-3 px-6 rounded-xl w-full">{isLoading ? 'Guardando...' : 'Confirmar Solicitud'}</button>
              </form>
            </div>
          )}

          {currentUser.role === "restaurant" && activeTab === "solicitudes" && (
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400"><tr><th className="p-4">Tipo</th><th className="p-4">Fecha</th><th className="p-4">Estado</th><th className="p-4">Peso</th></tr></thead>
                <tbody className="divide-y divide-zinc-900">
                  {pickups.map(p => (
                    <tr key={p.id}>
                      <td className="p-4">{p.waste_type}</td>
                      <td className="p-4">{p.date}</td>
                      <td className="p-4"><span className="text-emerald-400">{p.status}</span></td>
                      <td className="p-4">{p.actual_weight ? `${p.actual_weight} Kg` : `${p.estimated_weight} Kg (Est)`}</td>
                    </tr>
                  ))}
                  {pickups.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No hay solicitudes</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================== RECOLECTOR ================================== */}
          {currentUser.role === "collector" && activeTab === "rutas" && (
            <div className="grid gap-4 md:grid-cols-2">
              {pickups.filter(p => p.status === "Aprobado" || p.status === "En camino").map(p => (
                <div key={p.id} className="border border-zinc-800 rounded-2xl p-5 bg-zinc-900/30">
                  <h4 className="font-bold text-white mb-2">{p.waste_type} - {p.date}</h4>
                  <p className="text-xs text-zinc-400 mb-4">Estimado: {p.estimated_weight} Kg</p>
                  {p.status === "Aprobado" ? (
                    <button onClick={() => handleStartRoute(p.id)} className="w-full bg-amber-500 text-black py-2 rounded-xl text-sm font-bold">Iniciar Ruta</button>
                  ) : (
                    <button onClick={() => { setCompletingPickupId(p.id); setActualWeightInput(p.estimated_weight); }} className="w-full bg-emerald-500 text-black py-2 rounded-xl text-sm font-bold">Finalizar Recolección</button>
                  )}
                </div>
              ))}
              {pickups.filter(p => p.status === "Aprobado" || p.status === "En camino").length === 0 && <p>No hay rutas pendientes hoy.</p>}
            </div>
          )}

          {currentUser.role === "collector" && activeTab === "historial" && (
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden">
               <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400"><tr><th className="p-4">Tipo</th><th className="p-4">Fecha</th><th className="p-4">Peso Real</th></tr></thead>
                <tbody className="divide-y divide-zinc-900">
                  {pickups.filter(p => p.status === "Completado").map(p => (
                    <tr key={p.id}><td className="p-4">{p.waste_type}</td><td className="p-4">{p.date}</td><td className="p-4 text-emerald-400">{p.actual_weight} Kg</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================== ADMIN ================================== */}
          {currentUser.role === "admin" && activeTab === "dashboard" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <span className="text-zinc-400 text-sm">Total Global Reciclado</span>
                <h3 className="text-3xl font-bold text-emerald-400 mt-2">
                  {pickups.filter(p => p.status === "Completado").reduce((a, b) => a + (b.actual_weight || 0), 0)} Kg
                </h3>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <span className="text-zinc-400 text-sm">Solicitudes Globales</span>
                <h3 className="text-3xl font-bold text-white mt-2">{pickups.length}</h3>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <span className="text-zinc-400 text-sm">Usuarios en Sistema</span>
                <h3 className="text-3xl font-bold text-blue-400 mt-2">{allUsers.length}</h3>
              </div>
            </div>
          )}

          {currentUser.role === "admin" && activeTab === "solicitudes" && (
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden mt-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400"><tr><th className="p-4">Restaurante</th><th className="p-4">Tipo</th><th className="p-4">Estado</th><th className="p-4">Acción</th></tr></thead>
                <tbody className="divide-y divide-zinc-900">
                  {pickups.map(p => (
                    <tr key={p.id}>
                      <td className="p-4">{getRestaurantName(p.restaurant_id)}</td>
                      <td className="p-4">{p.waste_type}</td>
                      <td className="p-4">{p.status}</td>
                      <td className="p-4">
                        {p.status === "Pendiente" && (
                           <button onClick={() => setAssigningPickupId(p.id)} className="bg-blue-500 text-white px-3 py-1 rounded text-xs">Asignar Recolector</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================== PERFIL COMÚN ================================== */}
          {activeTab === "perfil" && (
            <div className="max-w-xl bg-zinc-900/50 border border-zinc-900 p-6 rounded-3xl mt-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-400"/> Seguridad y Acceso</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Nuevo Correo (Opcional)</label>
                  <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} placeholder={session?.user?.email} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500" />
                  <p className="text-xs text-zinc-500 mt-1">Si cambias el correo, se cerrará tu sesión y deberás confirmar la nueva dirección.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Nueva Contraseña (Opcional)</label>
                  <input type="password" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} placeholder="••••••••" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500" />
                </div>
                {profileMessage && (
                  <div className="p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg">
                    <p className="text-sm text-emerald-400 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> {profileMessage}</p>
                  </div>
                )}
                <button type="submit" disabled={isLoading} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl w-full transition-colors">
                  {isLoading ? 'Guardando...' : 'Actualizar Credenciales'}
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Modals for Assignment and Completion */}
        {assigningPickupId && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Asignar Recolector</h3>
              <select value={assignCollectorId} onChange={e => setAssignCollectorId(e.target.value)} className="w-full p-2 mb-4 bg-zinc-950 text-white rounded">
                <option value="">Selecciona un Recolector...</option>
                {allUsers.filter(u => u.role === "collector").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setAssigningPickupId(null)} className="flex-1 bg-zinc-800 p-2 rounded">Cancelar</button>
                <button onClick={handleAssignCollectorSubmit} className="flex-1 bg-blue-500 p-2 rounded text-white">Asignar</button>
              </div>
            </div>
          </div>
        )}

        {completingPickupId && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Registrar Peso Final</h3>
              <input type="number" step="0.1" value={actualWeightInput} onChange={e => setActualWeightInput(Number(e.target.value))} className="w-full p-2 mb-4 bg-zinc-950 text-white rounded" placeholder="Peso en Kg" />
              <div className="flex gap-2">
                <button onClick={() => setCompletingPickupId(null)} className="flex-1 bg-zinc-800 p-2 rounded">Cancelar</button>
                <button onClick={handleCompletePickupSubmit} className="flex-1 bg-emerald-500 text-black font-bold p-2 rounded">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto p-4 border-t border-zinc-900 bg-zinc-950/80 text-center text-xs text-zinc-500">
          Ciclo Verde App v1.0.0 • Desarrollado para impacto ambiental<br/>
          Administradores: Avigail Carcamo (avyrodriguez04@gmail.com) & Jose David Carranza (ing.josedavidcarranzaangarita@gmail.com)
        </footer>
      </main>
    </div>
  );
}
