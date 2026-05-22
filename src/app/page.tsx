"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
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
  Zap,
  Bell,
  Edit,
  Download
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Auth Forms
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  // State to keep temporary status changes made by admin in the "solicitudes" table
  const [adminStatusUpdates, setAdminStatusUpdates] = useState<Record<string, string>>({});
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authRole, setAuthRole] = useState<"restaurant" | "collector">("restaurant");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Pickup Forms
  const [newWasteType, setNewWasteType] = useState("Grasas y aceite");
  const [newEstimatedWeight, setNewEstimatedWeight] = useState(10);
  const [newDate, setNewDate] = useState("");
  const [newHour, setNewHour] = useState("14:00 - 16:00");
  const [newNotes, setNewNotes] = useState("");

  // Profile Forms
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Modals
  const [assigningPickupId, setAssigningPickupId] = useState<string | null>(null);
  const [assignCollectorId, setAssignCollectorId] = useState("");
  const [completingPickupId, setCompletingPickupId] = useState<string | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState(10);
  
  // Admin User Edit
  const [editingUser, setEditingUser] = useState<AppProfile | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserAddress, setEditUserAddress] = useState("");

  useEffect(() => {
    setMounted(true);
    let mySession: any = null;
    
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      mySession = session;
      if (session) fetchInitialData(session.user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      mySession = session;
      if (session) {
        fetchInitialData(session.user.id);
        if (_event === 'PASSWORD_RECOVERY') {
          setActiveTab('perfil');
          setIsEditingProfile(true);
          setProfileMessage("Por favor, ingresa tu nueva contraseña y presiona 'Guardar Todos los Cambios'.");
        }
      } else {
        setCurrentUser(null);
        setPickups([]);
        setAllUsers([]);
      }
    });

    // Check URL for recovery param or auth code from Supabase
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      
      // If Supabase ignored the redirectTo and sent the code to the root URL
      if (code) {
        window.location.href = `/auth/callback?code=${code}&next=/?recovery=true`;
        return;
      }

      if (searchParams.get('recovery') === 'true') {
        setActiveTab('perfil');
        setIsEditingProfile(true);
        setProfileMessage("Por favor, ingresa tu nueva contraseña y presiona 'Guardar Todos los Cambios'.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Realtime subscription for pickups (Si está habilitado en Supabase)
    const channel = supabase
      .channel('realtime_pickups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickups' }, (payload) => {
        if (mySession) fetchInitialData(mySession.user.id);
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [`Nueva solicitud de recolección: ${payload.new.waste_type}`, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev => [`El estado de la recolección cambió a ${payload.new.status} para ${payload.new.waste_type}`, ...prev]);
        }
      })
      .subscribe();

    // POLLEO CADA 5 SEGUNDOS (Garantiza actualización constante sin recargar la página)
    const interval = setInterval(async () => {
      if (mySession) {
        const { data } = await supabase.from("pickups").select("*").order("created_at", { ascending: false });
        if (data) {
          setPickups(prev => {
            // Si hay un pedido nuevo que no estaba en el estado anterior, lanzar notificación a la campanita
            if (prev.length > 0 && data.length > prev.length) {
              setNotifications(n => [`¡Tienes un nuevo movimiento en el panel!`, ...n]);
            }
            return data as PickupRequest[];
          });
        }
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
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
      setProfileAddress(profile.address || "");
      setProfilePhone(profile.phone || "");
      
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

    // 3. Fetch all users (para que los recolectores puedan ver direcciones de restaurantes)
    const { data: usersData } = await supabase.from("profiles").select("*");
    if (usersData) setAllUsers(usersData as AppProfile[]);
    
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
          },
          emailRedirectTo: `${window.location.origin}`,
        }
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setAuthMessage("Por favor verifica tu correo para confirmar tu registro.");
      }
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) {
      setAuthError("Por favor ingresa tu correo electrónico.");
      return;
    }
    setIsLoading(true);
    setAuthError("");
    setAuthMessage("");
    
    // Asume que Vercel origin funciona, sino supabase usará el default del Dashboard
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/?recovery=true`
    });
    
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage("Se ha enviado un enlace a tu correo para restablecer tu contraseña.");
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Admin: update pickup status (any status)
  const handleAdminUpdateStatus = async (pickupId: string) => {
    const newStatus = adminStatusUpdates[pickupId];
    if (!newStatus) return;
    setIsLoading(true);
    const { error } = await supabase.from('pickups').update({ status: newStatus }).eq('id', pickupId);
    if (error) {
      console.error('Error updating status:', error);
      setAuthError(error.message);
    } else {
      // Refetch pickups after update
      const { data, error: fetchErr } = await supabase
        .from('pickups')
        .select('*')
        .order('created_at', { ascending: false });
      if (!fetchErr) setPickups(data as PickupRequest[]);
    }
    setIsLoading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProfileMessage("");
    
    // 1. Actualizar Auth (Correo/Contraseña) si se llenaron
    const authUpdates: any = {};
    if (profileEmail && profileEmail !== session?.user?.email) authUpdates.email = profileEmail;
    if (profilePassword) authUpdates.password = profilePassword;
    
    let authUpdated = false;
    if (Object.keys(authUpdates).length > 0) {
      const { error } = await supabase.auth.updateUser(authUpdates);
      if (error) {
        setProfileMessage("Error Auth: " + error.message);
        setIsLoading(false);
        return;
      }
      authUpdated = true;
    }

    // 2. Actualizar Tabla Profiles (Dirección/Teléfono)
    if (currentUser) {
      const { error: profileError } = await supabase.from('profiles').update({
        address: profileAddress,
        phone: profilePhone
      }).eq('id', currentUser.id);

      if (profileError) {
        setProfileMessage("Error Perfil: " + profileError.message);
      } else {
        setProfileMessage(authUpdated 
          ? "¡Perfil y credenciales actualizados! (Confirma tu nuevo correo si lo cambiaste)" 
          : "¡Perfil actualizado correctamente!");
        // Actualizar estado local
        setCurrentUser({ ...currentUser, address: profileAddress, phone: profilePhone });
        setIsEditingProfile(false);
      }
    }
    
    setProfilePassword("");
    setIsLoading(false);
  };

  const handleRequestAccountDeletion = () => {
    alert("Tu solicitud de baja ha sido enviada a los administradores. Nos pondremos en contacto contigo pronto.");
  };

  const handleGeneratePDF = async () => {
    const doc = new jsPDF();
    
    try {
      // Intentar cargar la imagen de fondo
      const bgImg = new Image();
      bgImg.src = '/background.png';
      await new Promise((resolve, reject) => { 
        bgImg.onload = resolve; 
        bgImg.onerror = reject;
      });
      doc.addImage(bgImg, 'PNG', 0, 0, 210, 297); // Tamaño A4

      // Intentar cargar el logo
      const logoImg = new Image();
      logoImg.src = '/CicloVerde.jpeg';
      await new Promise((resolve, reject) => { 
        logoImg.onload = resolve; 
        logoImg.onerror = reject;
      });
      doc.addImage(logoImg, 'JPEG', 14, 10, 25, 25);
    } catch(e) {
      console.error("Error cargando imágenes para el PDF", e);
    }

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255); // Texto blanco para que resalte en el fondo oscuro
    doc.text("Reporte de Actividad - Ciclo Verde", 45, 25);
    
    doc.setFontSize(12);
    doc.text(`Generado por: ${currentUser?.name} (${currentUser?.role})`, 14, 45);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 52);

    const tableColumn = ["ID Pedido", "Fecha", "Tipo", "Estado", "Peso (Kg)"];
    const tableRows: any[] = [];
    
    const relevantPickups = currentUser?.role === 'admin' 
        ? pickups 
        : currentUser?.role === 'restaurant'
            ? pickups.filter(p => p.restaurant_id === currentUser.id)
            : pickups.filter(p => p.collector_id === currentUser?.id);

    relevantPickups.forEach(p => {
        tableRows.push([
            p.id.slice(0, 8),
            p.date,
            p.waste_type,
            p.status,
            (p.actual_weight || p.estimated_weight || 0).toString()
        ]);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 60,
        styles: { fontSize: 10, cellPadding: 4, textColor: [40, 40, 40] },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }, // emerald-500
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { top: 60 }
    });

    doc.save("Reporte_CicloVerde.pdf");
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

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    setIsLoading(true);
    const { error } = await supabase.from('profiles').update({
        name: editUserName,
        phone: editUserPhone,
        address: editUserAddress
    }).eq('id', editingUser.id);
    
    if (!error) {
        setAllUsers(allUsers.map(u => u.id === editingUser.id ? { ...u, name: editUserName, phone: editUserPhone, address: editUserAddress } : u));
        setEditingUser(null);
    } else {
        alert("Error al actualizar usuario: " + error.message);
    }
    setIsLoading(false);
  };

  const handleToggleUserStatus = async (user: AppProfile) => {
    if(!confirm(`¿Estás seguro de ${user.status === 'active' ? 'desactivar' : 'activar'} la cuenta de ${user.name}?`)) return;
    
    setIsLoading(true);
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
    if (!error) {
        setAllUsers(allUsers.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } else {
        alert("Error al cambiar estado: " + error.message);
    }
    setIsLoading(false);
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
          </div>          <div className="md:col-span-6 bg-zinc-950/90 border border-emerald-900/30 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
            
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Bienvenido a <br/><span className="text-emerald-400">Ciclo Verde</span></h2>
            <p className="text-zinc-400 mb-8 text-sm">Ingresa a la plataforma para gestionar recolecciones.</p>

            {!isResetPassword && (
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
            )}

            {isResetPassword ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-zinc-300 text-sm mb-4">Ingresa tu correo para recibir un enlace seguro y restablecer tu contraseña.</p>
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
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg mt-4"
                >
                  {isLoading ? "Enviando..." : "Enviar Enlace"}
                </button>

                <button
                  type="button"
                  onClick={() => { setIsResetPassword(false); setAuthError(""); setAuthMessage(""); }}
                  className="w-full mt-2 text-zinc-400 hover:text-white text-sm transition-colors py-2 block text-center"
                >
                  Volver a Iniciar Sesión
                </button>
              </form>
            ) : (
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

              {isLogin && (
                <div className="flex justify-end mt-1">
                  <button 
                    type="button" 
                    onClick={() => { setIsResetPassword(true); setAuthError(""); setAuthMessage(""); }} 
                    className="text-emerald-400 hover:text-emerald-300 text-xs transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {isLoading ? "Procesando..." : (isLogin ? "Iniciar Sesión" : "Registrarse")}
              </button>
              
            </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------
  // MAIN APP DASHBOARD
  // -----------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row relative overflow-hidden">
      
      {/* Imagen cubriendo toda la pantalla, anclada abajo para ver el diseño */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{ 
          backgroundImage: `url('/Dashboard_admind_restaurant_recollector.png')`,
          backgroundSize: 'cover', 
          backgroundPosition: 'bottom center', // Mantiene las hojas/diseño en la parte inferior
          backgroundRepeat: 'no-repeat',
          opacity: 0.45 // Un poco más vivo
        }}
      ></div>

      {/* Capa oscura extra para mayor legibilidad del texto */}
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px] z-0 pointer-events-none"></div>

      {/* Dynamic Background Glassmorphism (Luces de tu paleta sobre la imagen) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/20 blur-[100px] rounded-full"></div>
         <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/20 blur-[120px] rounded-full"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-900/10 blur-[150px] rounded-full"></div>
      </div>

      {/* Sidebar - Ahora más transparente para dejar ver el fondo */}
      <aside className="w-full md:w-64 bg-zinc-950/40 backdrop-blur-2xl border-r border-zinc-900/50 flex flex-col justify-between shrink-0 relative z-10">
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
                <button onClick={() => setActiveTab("usuarios")} className={`w-full text-left py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-3 ${activeTab === "usuarios" ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:bg-zinc-900"}`}>
                  <Users className="w-4 h-4"/>
                  Usuarios
                  {allUsers.filter(u => u.role !== 'admin').length > 0 && (
                    <span className="ml-auto bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{allUsers.filter(u => u.role !== 'admin').length}</span>
                  )}
                </button>
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
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative z-10">
        <header className="p-6 border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md shrink-0 flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white capitalize drop-shadow-md">{activeTab.replace('-', ' ')}</h1>
            <button onClick={handleGeneratePDF} className="bg-zinc-800 hover:bg-zinc-700 text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors border border-zinc-700">
              <Download className="w-3.5 h-3.5"/> PDF
            </button>
          </div>
          
          {/* Notificaciones */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-full hover:bg-zinc-800 transition-all relative group shadow-lg backdrop-blur-sm"
            >
              <Bell className="w-5 h-5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden transform origin-top-right transition-all">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2"><Bell className="w-4 h-4 text-emerald-400"/> Notificaciones</h3>
                  <button onClick={() => setNotifications([])} className="text-xs text-zinc-400 hover:text-white transition-colors">Limpiar</button>
                </div>
                <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-xs text-zinc-500 text-center">No hay notificaciones recientes</p>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i} className="p-3 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-xl mb-1 text-sm text-zinc-300 border border-zinc-700/30 transition-colors cursor-default">
                        {n}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="p-6 flex-grow relative z-10">
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
                  <option value="Grasas y aceite">Grasas y aceite</option>
                  <option value="Residuos de preparación y mesa">Residuos de preparación y mesa</option>
                  <option value="Residuos caducados y en mal estado">Residuos caducados y en mal estado</option>
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
                <thead className="bg-zinc-950 text-zinc-400"><tr><th className="p-4">Tipo</th><th className="p-4">Fecha</th><th className="p-4">Estado</th><th className="p-4">Peso</th><th className="p-4">Acciones</th></tr></thead>
                <tbody className="divide-y divide-zinc-900">
                  {pickups.map(p => (
                    <tr key={p.id}>
                      <td className="p-4">{p.waste_type}</td>
                      <td className="p-4">{p.date}</td>
                      <td className="p-4"><span className="text-emerald-400">{p.status}</span></td>
                      <td className="p-4">{p.actual_weight ? `${p.actual_weight} Kg` : `${p.estimated_weight} Kg (Est)`}</td>
                      <td className="p-4">
                        {p.status === "Pendiente" && (
                          <button onClick={() => handleCancelPickup(p.id)} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded transition-colors">
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pickups.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-zinc-500">No hay solicitudes</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================== RECOLECTOR ================================== */}
          {currentUser.role === "collector" && activeTab === "rutas" && (
            <div className="grid gap-4 md:grid-cols-2">
              {pickups.filter(p => p.status === "Aprobado" || p.status === "En camino").map(p => {
                const rest = allUsers.find(u => u.id === p.restaurant_id);
                return (
                  <div key={p.id} className="border border-zinc-800 rounded-2xl p-6 bg-zinc-900/60 backdrop-blur-md shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-lg text-emerald-400">{rest ? rest.name : "Restaurante Desconocido"}</h4>
                          <p className="text-sm text-zinc-300 font-medium">{p.waste_type} • {p.date}</p>
                        </div>
                        <span className="bg-zinc-950 text-zinc-300 text-xs px-3 py-1 rounded-full border border-zinc-800">{p.estimated_weight} Kg Est.</span>
                      </div>
                      
                      <div className="space-y-2 mb-6 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                        <p className="text-sm text-zinc-300 flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"/> 
                          <span className="leading-tight">{rest?.address || <span className="text-zinc-500 italic">Dirección no registrada por el restaurante</span>}</span>
                        </p>
                        {rest?.phone && (
                          <p className="text-sm text-zinc-300 flex items-center gap-3">
                            <span className="w-5 h-5 flex items-center justify-center text-emerald-500 shrink-0">📞</span> 
                            {rest.phone}
                          </p>
                        )}
                        {p.notes && (
                          <p className="text-sm text-amber-200/80 flex items-start gap-3 mt-2 border-t border-zinc-800/50 pt-2">
                            <FileText className="w-4 h-4 shrink-0 mt-0.5"/> 
                            <span className="italic text-xs">"{p.notes}"</span>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {p.status === "Aprobado" ? (
                      <button onClick={() => handleStartRoute(p.id)} className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2"><Truck className="w-4 h-4"/> Iniciar Ruta hacia el local</button>
                    ) : (
                      <button onClick={() => { setCompletingPickupId(p.id); setActualWeightInput(p.estimated_weight); }} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2"><CheckCircle className="w-4 h-4"/> Finalizar Recolección</button>
                    )}
                  </div>
                );
              })}
              {pickups.filter(p => p.status === "Aprobado" || p.status === "En camino").length === 0 && (
                <div className="col-span-2 text-center p-12 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed">
                  <p className="text-zinc-400">No tienes rutas pendientes asignadas para hoy.</p>
                </div>
              )}
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
                        {/* Admin can change status via dropdown */}
                        <select
                          value={adminStatusUpdates[p.id] || p.status}
                          onChange={(e) =>
                            setAdminStatusUpdates((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="bg-zinc-800 text-white rounded px-2 py-1 text-sm mr-2"
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="Aprobado">Aprobado</option>
                          <option value="En camino">En camino</option>
                          <option value="Completado">Completado</option>
                          <option value="Recogida">Recogida</option>
                          <option value="Disposición">Disposición</option>
                        </select>
                        <button
                          onClick={() => handleAdminUpdateStatus(p.id)}
                          className="bg-emerald-500 text-black px-3 py-1 rounded text-xs"
                        >
                          Guardar
                        </button>
                        {/* Assign collector if still pending */}
                        {p.status === "Pendiente" && (
                          <button
                            onClick={() => setAssigningPickupId(p.id)}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-xs ml-2"
                          >
                            Asignar Recolector
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================== ADMIN USUARIOS ================================== */}
          {currentUser.role === "admin" && activeTab === "usuarios" && (
            <div className="space-y-8">
              
              {/* Restaurantes */}
              <div>
                <h2 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <Leaf className="w-5 h-5"/> Restaurantes ({allUsers.filter(u => u.role === 'restaurant').length})
                </h2>
                <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950/80 text-zinc-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Nombre / Empresa</th>
                        <th className="p-4">Correo</th>
                        <th className="p-4">Dirección</th>
                        <th className="p-4">Teléfono</th>
                        <th className="p-4">Estado</th>
                        <th className="p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {allUsers.filter(u => u.role === 'restaurant').map(u => (
                        <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-emerald-900/50 flex items-center justify-center border border-emerald-500/30 text-emerald-400 font-bold text-sm shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-white">{u.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-zinc-300">{u.email}</td>
                          <td className="p-4">
                            {u.address 
                              ? <span className="text-zinc-300 flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-500 shrink-0"/> {u.address}</span>
                              : <span className="text-zinc-600 italic text-xs">Sin dirección</span>
                            }
                          </td>
                          <td className="p-4">
                            {u.phone 
                              ? <span className="text-zinc-300">{u.phone}</span>
                              : <span className="text-zinc-600 italic text-xs">Sin teléfono</span>
                            }
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                              {u.status === 'active' ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => {
                                setEditingUser(u);
                                setEditUserName(u.name);
                                setEditUserPhone(u.phone || "");
                                setEditUserAddress(u.address || "");
                              }} className="p-1.5 text-zinc-400 hover:text-emerald-400 bg-zinc-800 rounded transition-colors" title="Editar Información">
                                <Edit className="w-4 h-4"/>
                              </button>
                              <button onClick={() => handleToggleUserStatus(u)} className={`p-1.5 rounded transition-colors ${u.status === 'active' ? 'text-zinc-400 hover:text-red-400 bg-zinc-800' : 'text-zinc-400 hover:text-emerald-400 bg-zinc-800'}`} title={u.status === 'active' ? 'Desactivar Cuenta' : 'Activar Cuenta'}>
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {allUsers.filter(u => u.role === 'restaurant').length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-zinc-500 italic">No hay restaurantes registrados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recolectores */}
              <div>
                <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5"/> Recolectores ({allUsers.filter(u => u.role === 'collector').length})
                </h2>
                <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950/80 text-zinc-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Nombre</th>
                        <th className="p-4">Correo</th>
                        <th className="p-4">Teléfono</th>
                        <th className="p-4">Recolecciones</th>
                        <th className="p-4">Estado</th>
                        <th className="p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {allUsers.filter(u => u.role === 'collector').map(u => (
                        <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-amber-900/50 flex items-center justify-center border border-amber-500/30 text-amber-400 font-bold text-sm shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-white">{u.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-zinc-300">{u.email}</td>
                          <td className="p-4">
                            {u.phone 
                              ? <span className="text-zinc-300">{u.phone}</span>
                              : <span className="text-zinc-600 italic text-xs">Sin teléfono</span>
                            }
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-white">{pickups.filter(p => p.collector_id === u.id && p.status === 'Completado').length}</span>
                            <span className="text-zinc-500 text-xs ml-1">completadas</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.status === 'active' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                              {u.status === 'active' ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => {
                                setEditingUser(u);
                                setEditUserName(u.name);
                                setEditUserPhone(u.phone || "");
                                setEditUserAddress(u.address || "");
                              }} className="p-1.5 text-zinc-400 hover:text-amber-400 bg-zinc-800 rounded transition-colors" title="Editar Información">
                                <Edit className="w-4 h-4"/>
                              </button>
                              <button onClick={() => handleToggleUserStatus(u)} className={`p-1.5 rounded transition-colors ${u.status === 'active' ? 'text-zinc-400 hover:text-red-400 bg-zinc-800' : 'text-zinc-400 hover:text-emerald-400 bg-zinc-800'}`} title={u.status === 'active' ? 'Desactivar Cuenta' : 'Activar Cuenta'}>
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {allUsers.filter(u => u.role === 'collector').length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-zinc-500 italic">No hay recolectores registrados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "perfil" && (
            <div className="max-w-xl bg-zinc-900/70 backdrop-blur-md border border-zinc-800 p-8 rounded-3xl mt-6 shadow-2xl relative">
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-400"/> Datos del Perfil y Seguridad</h3>
                {!isEditingProfile && (
                  <button onClick={() => {
                    setProfileAddress(currentUser?.address || "");
                    setProfilePhone(currentUser?.phone || "");
                    setIsEditingProfile(true);
                    setProfileMessage("");
                  }} className="text-zinc-400 hover:text-emerald-400 transition-colors bg-zinc-800/50 p-2 rounded-lg" title="Editar Perfil">
                    <Edit className="w-4 h-4"/>
                  </button>
                )}
              </div>

              {profileMessage && !isEditingProfile && (
                <div className="mb-4 p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-xl animate-fade-in">
                  <p className="text-sm text-emerald-400 flex items-center gap-2 font-medium"><CheckCircle className="w-5 h-5"/> {profileMessage}</p>
                </div>
              )}

              {!isEditingProfile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Nombre</p>
                      <p className="text-zinc-200">{currentUser?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Rol</p>
                      <p className="text-emerald-400 capitalize">{currentUser?.role === 'restaurant' ? 'Restaurante' : currentUser?.role}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Correo Electrónico</p>
                      <p className="text-zinc-200">{session?.user?.email}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50 space-y-4">
                    <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider border-b border-zinc-800/50 pb-2">Información de Contacto</h4>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-2"><MapPin className="w-3 h-3"/> Dirección de Recolección</p>
                      <p className="text-zinc-200">{currentUser?.address || <span className="italic text-zinc-600">No registrada</span>}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-2"><span className="text-xs">📞</span> Teléfono</p>
                      <p className="text-zinc-200">{currentUser?.phone || <span className="italic text-zinc-600">No registrado</span>}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  
                  {/* Datos Públicos (Dirección y Teléfono) */}
                  <div className="space-y-4 pb-6 border-b border-zinc-800">
                    <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Información de Contacto</h4>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Dirección de Recolección</label>
                      <input type="text" value={profileAddress} onChange={e => setProfileAddress(e.target.value)} placeholder="Ej: Av. Principal 123, Local 4" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 transition-colors" />
                      <p className="text-xs text-zinc-500 mt-1">Los recolectores usarán esta dirección para llegar a ti.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Teléfono</label>
                      <input type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="Ej: +57 300 000 0000" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 transition-colors" />
                    </div>
                  </div>

                  {/* Datos Privados (Auth) */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Credenciales de Acceso</h4>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Nuevo Correo (Opcional)</label>
                      <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} placeholder={session?.user?.email} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Nueva Contraseña (Opcional)</label>
                      <input type="password" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} placeholder="••••••••" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 transition-colors" />
                    </div>
                  </div>

                  {profileMessage && (
                    <div className="p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-xl animate-fade-in">
                      <p className="text-sm text-emerald-400 flex items-center gap-2 font-medium"><CheckCircle className="w-5 h-5"/> {profileMessage}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => { setIsEditingProfile(false); setProfileMessage(""); }} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-6 rounded-xl w-1/3 transition-colors shadow-lg flex justify-center items-center">
                      Cancelar
                    </button>
                    <button type="submit" disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 px-6 rounded-xl w-2/3 transition-colors shadow-lg shadow-emerald-900/20 flex justify-center items-center gap-2">
                      {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-8 mt-8 border-t border-zinc-800/50">
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">Zona de Peligro</h4>
                <button type="button" onClick={handleRequestAccountDeletion} className="w-full bg-red-950/30 hover:bg-red-900/40 text-red-400 font-bold py-3 px-6 rounded-xl border border-red-900/50 transition-colors text-sm">
                  Solicitar Baja de la Cuenta
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modals for Assignment and Completion */}
        {editingUser && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="bg-zinc-900 p-6 rounded-3xl w-full max-w-md border border-zinc-800 shadow-2xl">
              <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2"><Edit className="w-5 h-5 text-emerald-400"/> Editar {editingUser.role === 'restaurant' ? 'Restaurante' : 'Recolector'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Nombre / Empresa</label>
                  <input type="text" value={editUserName} onChange={e => setEditUserName(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Dirección</label>
                  <input type="text" value={editUserAddress} onChange={e => setEditUserAddress(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Teléfono</label>
                  <input type="text" value={editUserPhone} onChange={e => setEditUserPhone(e.target.value)} className="w-full p-3 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setEditingUser(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 p-3 rounded-xl transition-colors font-semibold">Cancelar</button>
                <button onClick={handleSaveUserEdit} disabled={isLoading} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black p-3 rounded-xl font-bold transition-colors">{isLoading ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        )}

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
