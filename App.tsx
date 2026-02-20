
import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { 
  Role, 
  EstatusWorkflow, 
  Tramite, 
  TipoBeneficiario, 
  User,
  Bitacora
} from './types';
import { dbService, ensureSession, loginWithMatricula, logoutSession, adminCreateCapturista, adminResetPassword, AuthError, validatePasswordStrength, canAccessTabByRole, canAuthorizeImporte, validateLoginInput, validateNuevoTramiteStep1, validateNuevoTramiteStep2, UX_MESSAGES, TABS_BY_ROLE, SESSION_INVALID_TOKENS } from './services/db';
import { 
  LayoutDashboard, 
  FileText, 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  ShieldCheck,
  Printer,
  CreditCard,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
  Settings,
  LogOut,
  DollarSign
} from 'lucide-react';
import { generateFolio } from './utils';
import { COLOR_ESTATUS } from './constants';
import { PDFFormatoView } from './components/PDFFormatoView';
import { PDFTarjetaControlView } from './components/PDFTarjetaControlView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

type PrintDocumentType = 'formato' | 'tarjeta';
type PrintEmissionType = 'ORIGINAL' | 'REIMPRESION';

interface PrintMetadata {
  folio: string;
  documento: PrintDocumentType;
  emision: PrintEmissionType;
  autorizadoPor: string;
  fechaAutorizacion: string;
  motivoReimpresion?: string;
}

const SESSION_INVALID_MESSAGES = SESSION_INVALID_TOKENS;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tramites' | 'nuevo' | 'central' | 'adminUsers'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [selectedTramite, setSelectedTramite] = useState<Tramite | null>(null);
  const [printConfig, setPrintConfig] = useState<{show: boolean, type: PrintDocumentType, metadata?: PrintMetadata}>({show: false, type: 'formato'});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState<string | null>(null);

  // EFECTO DE INICIALIZACIÓN: Único punto de entrada
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const userProfile = await ensureSession();
        if (!isMounted) return;
        setUser(userProfile);

        if (!userProfile) {
          setLoading(false);
          return;
        }

        const data = await dbService.getTramites();
        if (!isMounted) return;
        setTramites(data || []);
      } catch (e: any) {
        console.error("Critical App Crash:", e);
        if (isMounted) setError(e.message || "Fallo en la conexión institucional.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initialize();
    return () => { isMounted = false; };
  }, []);

  const forceLogoutWithMessage = (message: string) => {
    logoutSession();
    setUser(null);
    setTramites([]);
    setSelectedTramite(null);
    setActiveTab('dashboard');
    setUiMessage(message);
  };

  const isSessionInvalidError = (e: any) => {
    const msg = String(e?.message || '');
    return (e instanceof AuthError && e.code === 'INVALID_SESSION') || SESSION_INVALID_MESSAGES.some(token => msg.includes(token));
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await dbService.getTramites();
      setTramites(data || []);
    } catch (e: any) {
      if (isSessionInvalidError(e)) {
        forceLogoutWithMessage(UX_MESSAGES.SESSION_INVALID);
        return;
      }
      setError(UX_MESSAGES.SYNC_ERROR);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const allowedTabs = TABS_BY_ROLE[user.role] || ['dashboard', 'tramites'];
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
      setUiMessage(UX_MESSAGES.TAB_REDIRECTED);
    }
  }, [user, activeTab]);

  const canAccessTab = (tab: 'dashboard' | 'tramites' | 'nuevo' | 'central' | 'adminUsers') => {
    if (!user) return false;
    return canAccessTabByRole(user.role, tab);
  };

  const goToTab = (tab: 'dashboard' | 'tramites' | 'nuevo' | 'central' | 'adminUsers') => {
    if (!canAccessTab(tab)) {
      setUiMessage(UX_MESSAGES.ACCESS_RESTRICTED);
      return;
    }
    setActiveTab(tab);
  };

  // MEMOS DEFENSIVOS: Verifican existencia antes de filtrar
  const filteredTramites = useMemo(() => {
    if (!Array.isArray(tramites)) return [];
    return tramites.filter(t => {
      const search = searchTerm.toLowerCase();
      const nombre = t.beneficiario?.nombre?.toLowerCase() || '';
      const paterno = t.beneficiario?.apellidoPaterno?.toLowerCase() || '';
      const nss = t.beneficiario?.nssTrabajador || '';
      const folio = t.folio?.toLowerCase() || '';
      
      return nombre.includes(search) || 
             paterno.includes(search) || 
             nss.includes(search) || 
             folio.includes(search);
    });
  }, [tramites, searchTerm]);

  const stats = useMemo(() => {
    if (!Array.isArray(tramites)) return { total: 0, pendientes: 0, autorizados: 0, entregados: 0, rechazados: 0 };
    return {
      total: tramites.length,
      pendientes: tramites.filter(t => t.estatus === EstatusWorkflow.EN_REVISION_DOCUMENTAL).length,
      autorizados: tramites.filter(t => t.estatus === EstatusWorkflow.AUTORIZADO).length,
      entregados: tramites.filter(t => t.estatus === EstatusWorkflow.ENTREGADO).length,
      rechazados: tramites.filter(t => t.estatus === EstatusWorkflow.RECHAZADO).length,
    };
  }, [tramites]);

  const chartData = [
    { name: 'Revisión', value: stats.pendientes },
    { name: 'Autorizados', value: stats.autorizados },
    { name: 'Entregados', value: stats.entregados },
    { name: 'Rechazados', value: stats.rechazados }
  ];

  const handleLogin = async (matricula: string, password: string) => {
    setLoading(true);
    setError(null);
    setUiMessage(null);
    try {
      const logged = await loginWithMatricula(matricula, password);
      setUser(logged);
      const allowedTabs = TABS_BY_ROLE[logged.role] || ['dashboard', 'tramites'];
      setActiveTab(allowedTabs[0]);
      const data = await dbService.getTramites();
      setTramites(data || []);
    } catch (e: any) {
      setError(e?.message || UX_MESSAGES.LOGIN_GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutSession();
    setUser(null);
    setTramites([]);
    setSelectedTramite(null);
    setActiveTab('dashboard');
    setUiMessage('Sesión cerrada correctamente.');
  };

  const gastoMetrics = useMemo(() => {
    if (!Array.isArray(tramites)) {
      return { global: 0, porUnidad: [], porPeriodo: [] };
    }

    const autorizados = tramites.filter(t => t.estatus === EstatusWorkflow.AUTORIZADO || t.estatus === EstatusWorkflow.ENTREGADO || t.estatus === EstatusWorkflow.CERRADO);
    const monto = (t: Tramite) => Number(t.importeAutorizado ?? t.importeSolicitado ?? 0);

    const global = autorizados.reduce((acc, t) => acc + monto(t), 0);

    const porUnidadMap = autorizados.reduce((acc: Record<string, number>, t) => {
      const key = t.unidad || t.beneficiario?.entidadLaboral || 'SIN_UNIDAD';
      acc[key] = (acc[key] || 0) + monto(t);
      return acc;
    }, {});

    const porPeriodoMap = autorizados.reduce((acc: Record<string, number>, t) => {
      const fecha = new Date(t.fechaValidacionImporte || t.fechaCreacion);
      const key = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
      acc[key] = (acc[key] || 0) + monto(t);
      return acc;
    }, {});

    const porUnidad = Object.entries(porUnidadMap)
      .map(([unidad, total]) => ({ unidad, total }))
      .sort((a, b) => Number(b.total) - Number(a.total));

    const porPeriodo = Object.entries(porPeriodoMap)
      .map(([periodo, total]) => ({ periodo, total }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    return { global, porUnidad, porPeriodo };
  }, [tramites]);

  const handleCreateTramite = async (newTramite: Tramite) => {
    if (!user) return;
    setLoading(true);
    try {
      const newId = await dbService.saveTramite(newTramite);
      await dbService.addBitacora({
        tramiteId: newId,
        usuario: user.nombre,
        accion: 'CREACIÓN CLOUD',
        descripcion: `Trámite ${newTramite.folio} creado exitosamente.`
      });
      await loadData();
      setActiveTab('tramites');
    } catch (e: any) {
      if (isSessionInvalidError(e)) {
        forceLogoutWithMessage(UX_MESSAGES.SESSION_INVALID);
        return;
      }
      setUiMessage(e?.message || 'No fue posible guardar el trámite.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEstatus = async (tramiteId: string, nuevoEstatus: EstatusWorkflow, nota?: string, importeAutorizado?: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const updateData: any = { id: tramiteId, estatus: nuevoEstatus };
      if (nota) updateData.motivoRechazo = nota;
      
      if (nuevoEstatus === EstatusWorkflow.AUTORIZADO) {
        if (!canAuthorizeImporte(user.role)) {
          throw new Error(UX_MESSAGES.UPDATE_STATUS_DENIED);
        }
        updateData.importeAutorizado = Number(importeAutorizado || 0);
        updateData.validadoPor = user.nombre;
        updateData.fechaValidacionImporte = new Date().toISOString();
        updateData.firmaAutorizacion = `AUTORIZADO ELECTRÓNICAMENTE POR ${user.nombre}`;
        updateData.nombreAutorizador = user.nombre;
      }

      await dbService.saveTramite(updateData);
      await loadData();
      const updated = (await dbService.getTramites()).find(t => t.id === tramiteId);
      if (updated) setSelectedTramite(updated);
    } catch (e: any) {
      if (isSessionInvalidError(e)) {
        forceLogoutWithMessage(UX_MESSAGES.SESSION_INVALID);
        return;
      }
      setUiMessage(e?.message || 'No fue posible actualizar el estatus.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintRequest = async (type: PrintDocumentType) => {
    if (!user || !selectedTramite) return;

    setLoading(true);
    try {
      const bitacoraActual = await dbService.getBitacora(selectedTramite.id);
      const impresionesPrevias = bitacoraActual.filter(
        (b) => b.categoria === 'IMPRESION' && b.datos?.documento === type
      ).length;

      const esReimpresion = impresionesPrevias > 0;
      let motivoReimpresion: string | undefined;

      if (esReimpresion) {
        const motivo = window.prompt('Este documento ya fue impreso. Captura el motivo de reimpresión (obligatorio):', '');
        if (!motivo || !motivo.trim()) {
          alert('La reimpresión requiere motivo obligatorio.');
          return;
        }
        motivoReimpresion = motivo.trim();
      }

      const fechaAutorizacion = new Date().toISOString();
      const metadata: PrintMetadata = {
        folio: selectedTramite.folio,
        documento: type,
        emision: esReimpresion ? 'REIMPRESION' : 'ORIGINAL',
        autorizadoPor: selectedTramite.nombreAutorizador || user.nombre,
        fechaAutorizacion,
        motivoReimpresion
      };

      await dbService.addBitacora({
        tramiteId: selectedTramite.id,
        usuario: user.nombre,
        accion: 'IMPRESION_DOCUMENTO',
        categoria: 'IMPRESION',
        descripcion: `${metadata.emision} de ${type.toUpperCase()} registrada para folio ${selectedTramite.folio}.`,
        datos: metadata
      });

      await dbService.saveTramite({
        id: selectedTramite.id,
        impresiones: {
          formato: (selectedTramite.impresiones?.formato || 0) + (type === 'formato' ? 1 : 0),
          tarjeta: (selectedTramite.impresiones?.tarjeta || 0) + (type === 'tarjeta' ? 1 : 0),
          ultimaFecha: fechaAutorizacion,
          ultimoUsuario: user.nombre,
          ultimoMotivoReimpresion: motivoReimpresion
        }
      });

      setPrintConfig({ show: true, type, metadata });
    } catch (e: any) {
      if (isSessionInvalidError(e)) {
        forceLogoutWithMessage(UX_MESSAGES.SESSION_INVALID);
        return;
      }
      setUiMessage('No fue posible registrar la impresión en bitácora.');
    } finally {
      setLoading(false);
    }
  };

  // VISTAS DE CARGA Y ERROR
  if (loading && !user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-imss-dark text-white">
        <Loader2 className="animate-spin mb-6 text-imss-gold" size={64} />
        <h2 className="text-2xl font-black uppercase tracking-[0.3em] animate-pulse">SISTRA Cloud</h2>
        <p className="text-imss-gold/60 mt-4 font-bold text-xs">INICIALIZANDO SESIÓN SEGURA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl max-w-lg border border-red-100 text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-6" size={64} />
          <h2 className="text-2xl font-black text-slate-800 uppercase mb-4">Error de Sincronización</h2>
          <p className="text-slate-600 mb-8">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-imss text-white font-black uppercase rounded-2xl">Reintentar</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} loading={loading} error={error} infoMessage={uiMessage} />;
  }

  // VISTA DE IMPRESIÓN (Separada del flujo principal para evitar fugas de memoria)
  if (printConfig.show && selectedTramite) {
    return (
      <div className="bg-white p-0">
        <div className="no-print p-4 bg-imss-dark text-white flex justify-between items-center sticky top-0 z-50">
          <button onClick={() => setPrintConfig({show: false, type: 'formato'})} className="flex items-center gap-2 font-bold uppercase text-xs">
            <ArrowLeft size={16} /> Volver al Sistema
          </button>
          <button onClick={() => window.print()} className="bg-imss px-6 py-2 rounded-xl flex items-center gap-2 font-black uppercase text-xs border border-white/20">
            <Printer size={16} /> Imprimir Documento
          </button>
        </div>
        <div className="print-stage print-container py-4 bg-slate-100 min-h-screen">
           {printConfig.type === 'formato' ? (
             <PDFFormatoView tramite={selectedTramite} metadata={printConfig.metadata} />
           ) : (
             <PDFTarjetaControlView 
               beneficiario={selectedTramite.beneficiario}
               dotaciones={tramites.filter(t => t.beneficiario?.nssTrabajador === selectedTramite.beneficiario?.nssTrabajador)}
               metadata={printConfig.metadata}
             />
           )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-shell flex flex-col lg:flex-row overflow-hidden bg-white">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 bg-imss-dark text-imss-light flex flex-col no-print border-b lg:border-b-0 lg:border-r border-white/5">
          <div className="p-4 lg:p-8">
            <div className="flex items-center gap-3 text-white mb-2">
              <div className="p-2 bg-imss rounded-xl shadow-lg border border-white/10">
                <ShieldCheck size={24} className="text-white" />
              </div>
              <span className="text-2xl font-black tracking-tighter">SISTRA</span>
            </div>
            <div className="flex items-center gap-2 mt-4">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest">En Línea (v2.7)</p>
            </div>
          </div>

          <nav className="mobile-scroll-x flex-1 px-3 lg:px-4 lg:space-y-2 mt-2 lg:mt-6 flex lg:block gap-2">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Tablero" active={activeTab === 'dashboard'} onClick={() => goToTab('dashboard')} />
            <SidebarItem icon={<Search size={20} />} label="Bandeja" active={activeTab === 'tramites'} onClick={() => goToTab('tramites')} />
            {canAccessTab('nuevo') && (
              <SidebarItem icon={<PlusCircle size={20} />} label="Nueva Captura" active={activeTab === 'nuevo'} onClick={() => goToTab('nuevo')} />
            )}
            {canAccessTab('central') && (
              <SidebarItem icon={<ClipboardCheck size={20} />} label="Central" active={activeTab === 'central'} onClick={() => goToTab('central')} />
            )}
            {canAccessTab('adminUsers') && (
              <SidebarItem icon={<Settings size={20} />} label="Usuarios" active={activeTab === 'adminUsers'} onClick={() => goToTab('adminUsers')} />
            )}
          </nav>

          <div className="hidden lg:block p-6 border-t border-white/5">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-imss flex items-center justify-center text-white font-black border border-imss-gold/40 shadow-inner">
                {user?.nombre.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-white truncate uppercase">{user?.nombre.split(' ')[0]}</p>
                <p className="text-[9px] text-imss-gold font-black truncate uppercase tracking-tighter">{user?.role.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden no-print bg-[#F9FBFC]">
          <header className="min-h-20 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between px-4 py-4 lg:px-10 shadow-sm z-10 gap-3">
            <div>
              <h2 className="text-base lg:text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <span className="w-1.5 h-8 bg-imss rounded-full"></span>
                {activeTab === 'dashboard' && 'Resumen Institucional'}
                {activeTab === 'tramites' && 'Gestión de Trámites'}
                {activeTab === 'nuevo' && 'Solicitud de Dotación'}
                {activeTab === 'central' && 'Auditoría Central'}
              </h2>
            </div>
            
            <div className="flex items-center gap-3 lg:gap-6 w-full lg:w-auto">
               <div className="relative group flex-1 lg:flex-none">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-imss transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar NSS o Folio..." 
                  aria-label="Buscar por NSS, folio o nombre"
                  className="pl-12 pr-6 py-3 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold focus:bg-white focus:border-imss outline-none w-full lg:w-80 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {loading && <Loader2 className="animate-spin text-imss" size={24} />}
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 lg:p-10">
            {uiMessage && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 px-5 py-4 text-sm font-bold flex items-center justify-between">
                <span>{uiMessage}</span>
                <button className="text-xs uppercase" onClick={() => setUiMessage(null)}>Cerrar</button>
              </div>
            )}
            {activeTab === 'dashboard' && <DashboardView stats={stats} chartData={chartData} gastoMetrics={gastoMetrics} />}
            {activeTab === 'tramites' && <TramitesListView tramites={filteredTramites} onSelect={setSelectedTramite} searchTerm={searchTerm} />}
            {activeTab === 'nuevo' && (canAccessTab('nuevo') ? <NuevoTramiteWizard user={user!} onSave={handleCreateTramite} /> : <AccessDeniedView />)}
            {activeTab === 'central' && (canAccessTab('central') ? <CentralView tramites={tramites} /> : <AccessDeniedView />)}
            {activeTab === 'adminUsers' && (canAccessTab('adminUsers') ? <AdminUsersView currentUser={user} /> : <AccessDeniedView />)}
          </div>
        </main>

        {selectedTramite && (
          <TramiteDetailModal 
            tramite={selectedTramite} 
            user={user!}
            onClose={() => setSelectedTramite(null)} 
            onUpdateEstatus={handleUpdateEstatus}
            onPrint={handlePrintRequest}
            historicalDotations={tramites.filter(t => t.beneficiario?.nssTrabajador === selectedTramite.beneficiario?.nssTrabajador)}
            loading={loading}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// COMPONENTES AUXILIARES CON GUARDS
const LoginView = ({ onLogin, loading, error, infoMessage }: any) => {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const matriculaNormalized = (matricula || '').trim();
    const passwordValue = password || '';

    const validationError = validateLoginInput(matriculaNormalized, passwordValue);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    onLogin(matriculaNormalized, passwordValue);
  };

  return (
    <div className="h-screen bg-slate-100 flex items-center justify-center p-4 lg:p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md institutional-card p-6 lg:p-10"
      >
        <h1 className="text-2xl font-black text-imss-dark uppercase mb-8">Acceso SISTRA</h1>
        <label className="field-label">Matrícula</label>
        <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className="field-input mb-5 uppercase" placeholder="Ej. CAP001" required />
        <label className="field-label">Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field-input mb-6" placeholder="********" required />
        {infoMessage && <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold mb-4">{infoMessage}</p>}
        {(localError || error) && <p className="text-red-600 text-sm font-bold mb-4">{localError || error}</p>}
        <button disabled={loading} className="w-full py-4 rounded-xl btn-institutional disabled:opacity-50">
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
        <p className="text-[11px] text-slate-500 mt-4">Acceso con Firebase Auth (matrícula + contraseña).</p>
      </form>
    </div>
  );
};

const AdminUsersView = ({ currentUser }: { currentUser: User }) => {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [nombre, setNombre] = useState('');
  const [matricula, setMatricula] = useState('');
  const [unidad, setUnidad] = useState('');
  const [ooad, setOoad] = useState('');
  const [password, setPassword] = useState('');
  const [resetPasswordByUser, setResetPasswordByUser] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = async () => setUsuarios(await dbService.getUsers());
  useEffect(() => { refresh(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-3xl p-8 border border-slate-100">
        <h3 className="font-black uppercase mb-6">Alta de Capturista</h3>
        {feedback && <p className="mb-3 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg px-3 py-2">{feedback}</p>}
        <div className="space-y-3">
          <input className="w-full p-3 border rounded-xl" placeholder="Nombre" value={nombre} onChange={(e)=>setNombre(e.target.value)} />
          <input className="w-full p-3 border rounded-xl" placeholder="Matrícula" value={matricula} onChange={(e)=>setMatricula(e.target.value)} />
          <input className="w-full p-3 border rounded-xl" placeholder="Unidad" value={unidad} onChange={(e)=>setUnidad(e.target.value)} />
          <input className="w-full p-3 border rounded-xl" placeholder="OOAD" value={ooad} onChange={(e)=>setOoad(e.target.value)} />
          <input type="password" className="w-full p-3 border rounded-xl" placeholder="Contraseña inicial" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="w-full py-3 bg-imss text-white rounded-xl font-black uppercase" onClick={async ()=>{
            const issues = validatePasswordStrength(password);
            if (issues.length > 0) {
              setFeedback(`No se puede crear usuario. ${issues.join(' ')}`);
              return;
            }
            try {
              await adminCreateCapturista(currentUser, { nombre, matricula, unidad, ooad, password, role: Role.CAPTURISTA_UNIDAD });
              setNombre('');setMatricula('');setUnidad('');setOoad('');setPassword('');
              await refresh();
              setFeedback('Capturista creado correctamente.');
            } catch (e: any) { setFeedback(e?.message || 'No se pudo crear el capturista.'); }
          }}>Crear capturista</button>
        </div>
      </div>
      <div className="bg-white rounded-3xl p-8 border border-slate-100">
        <h3 className="font-black uppercase mb-6">Reset administrativo</h3>
        <div className="space-y-3 max-h-[500px] overflow-auto">
          {usuarios.map((u) => (
            <div key={u.id} className="border rounded-xl p-3">
              <p className="font-black text-sm">{u.nombre} · {u.matricula}</p>
              <p className="text-xs text-slate-500">{u.role} · {u.unidad} · {u.activo ? 'ACTIVO' : 'INACTIVO'}</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  className="flex-1 p-2 border rounded-lg"
                  placeholder="Nueva contraseña"
                  value={resetPasswordByUser[u.id] || ''}
                  onChange={(e)=>setResetPasswordByUser(prev => ({ ...prev, [u.id]: e.target.value }))}
                />
                <button className="px-3 bg-slate-800 text-white rounded-lg text-xs" onClick={async ()=>{
                  const candidate = (resetPasswordByUser[u.id] || '').trim();
                  const issues = validatePasswordStrength(candidate);
                  if (issues.length > 0) {
                    setFeedback(`No se pudo resetear a ${u.matricula}. ${issues.join(' ')}`);
                    return;
                  }
                  try {
                    await adminResetPassword(currentUser, u.id, candidate);
                    setResetPasswordByUser(prev => ({ ...prev, [u.id]: '' }));
                    setFeedback(`Correo de restablecimiento enviado para ${u.matricula}.`);
                  }
                  catch(e:any){ setFeedback(e?.message || 'No se pudo resetear la contraseña.'); }
                }}>Reset</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AccessDeniedView = () => (
  <div className="bg-white rounded-3xl border border-red-100 p-10 text-center">
    <AlertTriangle className="mx-auto text-red-500 mb-4" />
    <p className="font-black text-slate-700 uppercase text-sm">No tienes permisos para ver esta sección.</p>
    <p className="text-xs text-slate-500 mt-2">Si consideras que es un error, contacta al administrador del sistema.</p>
  </div>
);

const SidebarItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-auto lg:w-full whitespace-nowrap flex items-center gap-3 px-4 lg:px-5 py-3 lg:py-4 rounded-2xl text-xs lg:text-sm font-black uppercase tracking-widest transition-all ${active ? 'bg-imss text-white shadow-xl' : 'hover:bg-white/5 text-imss-light/60 hover:text-white'}`}>
    {icon}{label}
  </button>
);

const DashboardView = ({ stats, chartData, gastoMetrics }: any) => (
  <div className="space-y-10 animate-in fade-in duration-700">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
      <StatCard label="Total Cloud" value={stats.total} icon={<FileText className="text-imss" />} color="imss" />
      <StatCard label="Por Validar" value={stats.pendientes} icon={<Clock className="text-amber-600" />} color="amber" />
      <StatCard label="Autorizados" value={stats.autorizados} icon={<CheckCircle2 className="text-emerald-600" />} color="emerald" />
      <StatCard label="Entregados" value={stats.entregados} icon={<LogOut className="text-slate-600" />} color="slate" />
      <StatCard label="Gasto Global" value={`$${Number(gastoMetrics.global || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<DollarSign className="text-imss" />} color="imss" />
    </div>
    
    <div className="bg-white p-12 rounded-[50px] border border-slate-100 shadow-sm min-h-[500px] flex flex-col">
       <div className="flex items-center justify-between mb-12">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Indicadores de Gestión Nacional</h3>
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-imss rounded-full"></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trámites Activos</span>
          </div>
       </div>
       <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 900, fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 900, fill: '#64748b'}} />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)'}} />
              <Bar dataKey="value" fill="#006747" radius={[15, 15, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
       </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <SimpleSpendTable title="Gasto por Unidad" rows={(gastoMetrics.porUnidad || []).map((x: any) => ({ label: x.unidad, value: x.total }))} />
      <SimpleSpendTable title="Gasto por Periodo" rows={(gastoMetrics.porPeriodo || []).map((x: any) => ({ label: x.periodo, value: x.total }))} />
    </div>
  </div>
);

const StatCard = ({ label, value, icon, color }: any) => {
  const bgColors: any = { imss: 'bg-imss-light', amber: 'bg-amber-100', emerald: 'bg-emerald-100', slate: 'bg-slate-100' };
  return (
    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center justify-between group transition-all hover:shadow-xl hover:-translate-y-1">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</p>
        <p className="text-4xl font-black text-slate-800">{value}</p>
      </div>
      <div className={`p-5 rounded-[24px] ${bgColors[color]} group-hover:scale-110 transition-transform`}>{icon}</div>
    </div>
  );
};

const SimpleSpendTable = ({ title, rows }: any) => (
  <div className="bg-white rounded-[40px] border border-slate-100 p-8">
    <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-6">{title}</h4>
    <div className="space-y-3 max-h-64 overflow-auto">
      {rows.length ? rows.map((row: any, idx: number) => (
        <div key={`${row.label}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <span className="text-xs font-black uppercase text-slate-600">{row.label}</span>
          <span className="text-xs font-black text-imss">${Number(row.value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )) : (
        <p className="text-xs text-slate-400 font-bold">Sin datos de gasto.</p>
      )}
    </div>
  </div>
);

const TramitesListView = ({ tramites, onSelect, searchTerm = '' }: any) => (
  <div className="institutional-card rounded-[28px] lg:rounded-[50px] overflow-hidden animate-in slide-in-from-bottom-6 duration-500" aria-live="polite">
    <div className="mobile-scroll-x">
    <table className="w-full min-w-[760px] text-left border-collapse">
      <caption className="sr-only">Bandeja de trámites</caption>
      <thead className="bg-imss-dark">
        <tr>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest">Identificador</th>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest">Solicitante</th>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest text-center">Estatus Cloud</th>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest text-right">Acción</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {tramites.length > 0 ? tramites.map((t: Tramite) => (
          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => onSelect(t)}>
            <td className="px-10 py-8">
              <p className="font-black text-imss-dark text-sm tracking-tight">{t.folio}</p>
              <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Fecha: {new Date(t.fechaCreacion).toLocaleDateString()}</p>
            </td>
            <td className="px-10 py-8">
              <p className="font-black text-slate-800 text-sm uppercase">{t.beneficiario?.nombre || 'N/A'} {t.beneficiario?.apellidoPaterno || ''}</p>
              <p className="text-[10px] text-imss font-black mt-1">NSS: {t.beneficiario?.nssTrabajador || 'SIN NSS'}</p>
            </td>
            <td className="px-10 py-8 text-center">
              <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${(COLOR_ESTATUS as any)[t.estatus]}`}>
                {t.estatus.replace(/_/g, ' ')}
              </span>
            </td>
            <td className="px-10 py-8 text-right">
              <button aria-label={`Abrir detalle del folio ${t.folio}`} className="p-4 bg-slate-100 rounded-2xl text-slate-400 group-hover:bg-imss group-hover:text-white transition-all shadow-sm">
                <ChevronRight size={20} />
              </button>
            </td>
          </tr>
        )) : (
          <tr>
            <td colSpan={4} className="px-10 py-32 text-center text-slate-400 font-black uppercase tracking-[0.2em]">
              {searchTerm ? `Sin coincidencias para "${searchTerm}".` : 'Sin registros sincronizados'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
    </div>
  </div>
);

const TramiteDetailModal = ({ tramite, user, onClose, onUpdateEstatus, onPrint, historicalDotations, loading }: any) => {
  const [activeTab, setActiveTab] = useState<'info' | 'bitacora' | 'tarjeta'>('info');
  const [bitacora, setBitacora] = useState<Bitacora[]>([]);
  const [importeAutorizado, setImporteAutorizado] = useState<number>(Number(tramite.importeAutorizado ?? tramite.importeSolicitado ?? 0));

  useEffect(() => {
    let isMounted = true;
    const fetchBitacora = async () => {
      try {
        const data = await dbService.getBitacora(tramite.id);
        if (isMounted) setBitacora(data);
      } catch (e) {
        if (isMounted) setBitacora([]);
      }
    };
    fetchBitacora();
    return () => { isMounted = false; };
  }, [tramite.id]);

  const canApprove = canAuthorizeImporte(user.role) && tramite.estatus === EstatusWorkflow.EN_REVISION_DOCUMENTAL;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-imss-dark/80 backdrop-blur-xl z-50 flex items-center justify-center p-2 lg:p-8 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-label={`Detalle del trámite ${tramite.folio}`}>
       <div className="bg-white rounded-3xl lg:rounded-[60px] w-full max-w-6xl h-[96vh] lg:h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/20">
          <div className="px-4 py-4 lg:px-12 lg:py-10 bg-imss-dark text-white flex flex-col lg:flex-row justify-between lg:items-center shrink-0 border-b border-imss-gold/20 gap-3">
             <div>
               <div className="flex items-center gap-6">
                 <h2 className="text-4xl font-black tracking-tighter">{tramite.folio}</h2>
                 <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${(COLOR_ESTATUS as any)[tramite.estatus]}`}>
                   {tramite.estatus.replace(/_/g, ' ')}
                 </span>
               </div>
               <p className="text-imss-gold font-black text-[10px] uppercase tracking-[0.3em] mt-3">SISTRA ID: {tramite.id}</p>
             </div>
             <div className="flex items-center gap-4">
               <button onClick={() => onPrint('formato')} disabled={tramite.estatus !== EstatusWorkflow.AUTORIZADO && tramite.estatus !== EstatusWorkflow.ENTREGADO && tramite.estatus !== EstatusWorkflow.CERRADO} title="Solo disponible para trámites autorizados" className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-3 text-xs font-black uppercase tracking-widest border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed">
                 <Printer size={20} className="text-imss-gold" /> Formato 027
               </button>
               <button onClick={() => onPrint('tarjeta')} disabled={tramite.estatus !== EstatusWorkflow.AUTORIZADO && tramite.estatus !== EstatusWorkflow.ENTREGADO && tramite.estatus !== EstatusWorkflow.CERRADO} title="Solo disponible para trámites autorizados" className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-3 text-xs font-black uppercase tracking-widest border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed">
                 <CreditCard size={20} className="text-imss-gold" /> Tarjeta 028
               </button>
               <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/20 rounded-2xl text-white/40 hover:text-white transition-all">
                 <XCircle size={32} />
               </button>
             </div>
          </div>

          <div className="mobile-scroll-x flex border-b border-slate-100 bg-slate-50 px-2 lg:px-12">
             <TabButton label="Información General" active={activeTab === 'info'} onClick={() => setActiveTab('info')} />
             <TabButton label="Historial Institucional" active={activeTab === 'tarjeta'} onClick={() => setActiveTab('tarjeta')} />
             <TabButton label="Bitácora Cloud" active={activeTab === 'bitacora'} onClick={() => setActiveTab('bitacora')} />
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-12 bg-white">
            {tramite.estatus !== EstatusWorkflow.AUTORIZADO && tramite.estatus !== EstatusWorkflow.ENTREGADO && tramite.estatus !== EstatusWorkflow.CERRADO && (
              <div className="mb-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black uppercase tracking-wider">
                La impresión se habilita al autorizar el trámite.
              </div>
            )}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
                <div className="space-y-10">
                  <div className="p-10 bg-slate-50 rounded-[40px] border border-slate-100 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase mb-8 tracking-[0.2em]">Cédula del Beneficiario</h4>
                    <div className="grid grid-cols-1 gap-8">
                      <div><p className="text-slate-400 font-black uppercase text-[9px] mb-2 tracking-widest">Nombre del Solicitante</p><p className="font-black text-slate-800 text-xl uppercase leading-tight">{tramite.beneficiario?.nombre} {tramite.beneficiario?.apellidoPaterno}</p></div>
                      <div className="grid grid-cols-2 gap-6">
                        <div><p className="text-slate-400 font-black uppercase text-[9px] mb-2 tracking-widest">NSS</p><p className="font-black text-imss text-lg tracking-widest">{tramite.beneficiario?.nssTrabajador}</p></div>
                        <div><p className="text-slate-400 font-black uppercase text-[9px] mb-2 tracking-widest">Unidad</p><p className="font-black text-slate-800 uppercase text-lg">{tramite.beneficiario?.entidadLaboral}</p></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-10">
                   <div className="p-10 bg-imss-light/30 rounded-[40px] border border-imss/10 space-y-6">
                    <h4 className="text-[11px] font-black text-imss/50 uppercase tracking-[0.2em]">Gestión de Importe y Validación</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-2xl p-4 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Importe solicitado</p>
                        <p className="text-lg font-black text-slate-700">${Number(tramite.importeSolicitado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-white rounded-2xl p-4 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Importe autorizado</p>
                        <p className="text-lg font-black text-imss">${Number(tramite.importeAutorizado ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    {canApprove ? (
                      <>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Monto a autorizar (solo admin)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={importeAutorizado}
                            onChange={(e) => setImporteAutorizado(Number(e.target.value || 0))}
                            className="w-full p-4 rounded-2xl border-2 border-slate-200 font-black text-imss"
                          />
                        </div>
                        <button 
                          disabled={loading || importeAutorizado < 0} 
                          onClick={() => onUpdateEstatus(tramite.id, EstatusWorkflow.AUTORIZADO, undefined, importeAutorizado)} 
                          className="w-full py-6 bg-imss text-white font-black uppercase text-xs tracking-widest rounded-[24px] hover:bg-imss-dark shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-4"
                        >
                          {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                          {loading ? 'SINCRONIZANDO...' : 'VALIDAR IMPORTE Y AUTORIZAR'}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-4 text-slate-400 bg-white p-6 rounded-2xl border border-slate-100">
                        <AlertTriangle size={20} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Solo ADMIN_SISTEMA puede validar y autorizar importes.</p>
                      </div>
                    )}

                    {(tramite.validadoPor || tramite.fechaValidacionImporte) && (
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white p-4 rounded-2xl border border-slate-100">
                        Validado por: {tramite.validadoPor || 'N/A'} · Fecha: {tramite.fechaValidacionImporte ? new Date(tramite.fechaValidacionImporte).toLocaleString() : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bitacora' && (
              <div className="space-y-6">
                 {bitacora.length > 0 ? bitacora.map((b) => (
                   <div key={b.id} className="p-6 bg-slate-50 border-l-[6px] border-imss rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <p className="font-black text-imss-dark text-sm uppercase">{b.accion}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(b.fecha).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed mb-2">{b.descripcion}</p>
                      {b.categoria && (
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Categoría: {b.categoria}</p>
                      )}
                      {b.datos?.folio && (
                        <p className="text-[10px] font-bold text-slate-500 mb-4">
                          Folio: {b.datos.folio} · Emisión: {b.datos.emision || 'N/A'} · Documento: {b.datos.documento || 'N/A'}
                        </p>
                      )}
                      <div className="pt-4 border-t border-slate-200 flex items-center gap-2">
                         <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black">{b.usuario?.charAt(0)}</div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operador Cloud: {b.usuario}</p>
                      </div>
                   </div>
                 )) : (
                   <div className="text-center py-32 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
                      <p className="text-slate-400 font-black uppercase tracking-[0.3em] opacity-40">Bitácora en blanco</p>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'tarjeta' && (
              <div className="grid grid-cols-1 gap-6">
                 {historicalDotations.length > 0 ? historicalDotations.sort((a: any, b: any) => a.dotacionNumero - b.dotacionNumero).map((d: Tramite) => (
                   <div key={d.id} className="flex items-center justify-between p-8 bg-slate-50 border border-slate-100 rounded-[32px] hover:bg-white hover:shadow-xl transition-all cursor-default">
                     <div className="flex items-center gap-8">
                       <div className="w-16 h-16 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400">DOT</span>
                          <span className="text-2xl font-black text-imss">{d.dotacionNumero}</span>
                       </div>
                       <div>
                         <p className="font-black text-slate-800 text-lg uppercase tracking-tight">Folio: {d.folio}</p>
                         <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Sincronizado el {new Date(d.fechaCreacion).toLocaleDateString()}</p>
                       </div>
                     </div>
                     <span className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${(COLOR_ESTATUS as any)[d.estatus]}`}>
                        {d.estatus.replace(/_/g, ' ')}
                     </span>
                   </div>
                 )) : (
                   <div className="text-center py-32 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
                      <p className="text-slate-400 font-black uppercase tracking-[0.3em] opacity-40">Sin historial previo de dotaciones</p>
                   </div>
                 )}
              </div>
            )}
          </div>
       </div>
    </div>
  );
};

const TabButton = ({ label, active, onClick }: any) => (
  <button onClick={onClick} className={`whitespace-nowrap px-4 lg:px-10 py-4 lg:py-5 text-[10px] font-black uppercase tracking-widest transition-all border-b-4 ${active ? 'border-imss text-imss bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{label}</button>
);

const NuevoTramiteWizard = ({ user, onSave }: any) => {
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string>('');
  const [beneficiario, setBeneficiario] = useState<any>({
    tipo: TipoBeneficiario.TRABAJADOR,
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nssTrabajador: '',
    entidadLaboral: user.unidad,
    ooad: user.ooad
  });
  const [receta, setReceta] = useState({ folio: '', descripcion: '', dotacionNo: 1, importeSolicitado: 0 });

  const validateStep1 = () => {
    return validateNuevoTramiteStep1({
      nombre: beneficiario.nombre,
      nssTrabajador: beneficiario.nssTrabajador
    });
  };

  const validateStep2 = () => {
    return validateNuevoTramiteStep2({
      folioRecetaImss: receta.folio,
      descripcionLente: receta.descripcion,
      importeSolicitado: Number(receta.importeSolicitado || 0)
    });
  };

  const goToStep = (targetStep: number) => {
    const validationError = step === 1 ? validateStep1() : step === 2 ? validateStep2() : '';
    if (targetStep > step && validationError) {
      setStepError(validationError);
      return;
    }
    setStepError('');
    setStep(targetStep);
  };

  const handleFinalize = () => {
    const validationError = validateStep2();
    if (validationError) {
      setStepError(validationError);
      setStep(2);
      return;
    }
    const tramite: Tramite = {
      id: '', 
      folio: generateFolio(user.unidad, Math.floor(Math.random() * 1000)),
      beneficiario,
      fechaCreacion: new Date().toISOString(),
      creadorId: user.id,
      unidad: user.unidad,
      estatus: EstatusWorkflow.EN_REVISION_DOCUMENTAL,
      dotacionNumero: receta.dotacionNo,
      requiereDictamenMedico: receta.dotacionNo >= 3,
      importeSolicitado: Number(receta.importeSolicitado || 0),
      folioRecetaImss: receta.folio,
      fechaExpedicionReceta: new Date().toISOString(),
      descripcionLente: receta.descripcion,
      clavePresupuestal: '1A14-009-027',
      checklist: {} as any,
      evidencias: [],
    };
    onSave(tramite);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-[60px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in duration-500">
      <div className="bg-imss-dark px-12 py-12 flex gap-12 justify-center border-b border-imss-gold/20">
         {[1, 2, 3].map(s => (
           <div key={s} className="flex flex-col items-center gap-3">
             <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black transition-all ${step === s ? 'bg-imss-gold text-white shadow-xl scale-110' : step > s ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'}`}>
               {step > s ? <CheckCircle2 size={28} /> : s}
             </div>
             <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${step === s ? 'text-white' : 'text-white/20'}`}>
               {s === 1 ? 'Solicitante' : s === 2 ? 'Médico' : 'Finalizar'}
             </span>
           </div>
         ))}
      </div>
      <div className="p-20">
        {stepError && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold" role="alert">
            {stepError}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="md:col-span-2">
                 <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Nombre del Beneficiario</label>
                 <input placeholder="NOMBRE COMPLETO" aria-label="Nombre del beneficiario" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={beneficiario.nombre} onChange={(e) => { setStepError(''); setBeneficiario({...beneficiario, nombre: e.target.value}); }} />
               </div>
               <div>
                 <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">NSS Institucional</label>
                 <input placeholder="0000000000" aria-label="NSS institucional" inputMode="numeric" maxLength={11} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black text-imss text-xl tracking-[0.2em] shadow-inner" value={beneficiario.nssTrabajador} onChange={(e) => { setStepError(''); setBeneficiario({...beneficiario, nssTrabajador: e.target.value.replace(/\D/g, '')}); }} />
               </div>
             </div>
             <button onClick={() => goToStep(2)} className="w-full py-7 bg-imss text-white rounded-[32px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-imss-dark transition-all">Siguiente Fase</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
             <div>
               <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Folio de Receta 1A14</label>
               <input placeholder="FOLIO RECETA" aria-label="Folio de receta" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={receta.folio} onChange={(e) => { setStepError(''); setReceta({...receta, folio: e.target.value}); }} />
             </div>
             <div>
               <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Diagnóstico y Especificación</label>
               <textarea placeholder="DESCRIBA LA GRADUACIÓN..." aria-label="Diagnóstico y especificación" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl h-44 outline-none focus:border-imss transition-all font-bold uppercase text-slate-800 shadow-inner" value={receta.descripcion} onChange={(e) => { setStepError(''); setReceta({...receta, descripcion: e.target.value}); }} />
             </div>
             <div>
               <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Importe Solicitado (MXN)</label>
               <input type="number" min={0} step="0.01" placeholder="0.00" aria-label="Importe solicitado" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black text-imss text-xl shadow-inner" value={receta.importeSolicitado} onChange={(e) => { setStepError(''); setReceta({...receta, importeSolicitado: Number(e.target.value || 0)}); }} />
             </div>
             <div className="flex gap-6">
               <button onClick={() => goToStep(1)} className="px-12 py-7 text-slate-400 font-black uppercase tracking-widest hover:text-slate-800 transition-colors">Atrás</button>
               <button onClick={() => goToStep(3)} className="flex-1 py-7 bg-imss text-white rounded-[32px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-imss-dark transition-all">Siguiente Fase</button>
             </div>
          </div>
        )}
        {step === 3 && (
          <div className="text-center py-10 animate-in zoom-in duration-500">
            <div className="w-28 h-28 bg-imss-light rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
               <ShieldCheck className="text-imss" size={56} />
            </div>
            <h3 className="text-4xl font-black text-slate-800 uppercase mb-6 tracking-tighter">Validación de Registro</h3>
            <p className="text-slate-500 mb-14 max-w-md mx-auto font-medium leading-relaxed uppercase text-xs tracking-widest">La solicitud será firmada digitalmente y sincronizada con el servidor central de prestaciones.</p>
            <div className="flex gap-6">
               <button onClick={() => goToStep(2)} className="px-12 py-7 text-slate-400 font-black uppercase tracking-widest hover:text-slate-800 transition-colors">Revisar</button>
               <button onClick={handleFinalize} className="flex-1 py-7 bg-imss-dark text-white rounded-[32px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all">Sincronizar Solicitud</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CentralView = ({ tramites }: any) => (
  <div className="space-y-10 animate-in fade-in duration-700">
     <div className="bg-imss-dark p-16 rounded-[60px] shadow-2xl flex justify-between items-center border-b-8 border-imss-gold/30">
        <div>
           <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Consolidado Nacional</h3>
           <p className="text-imss-gold font-black text-xs uppercase tracking-[0.4em] mt-3">Gestión de Auditoría y Control Fiscal</p>
        </div>
        <div className="bg-white/10 px-8 py-5 rounded-[24px] backdrop-blur-md border border-white/5">
           <p className="text-white font-black text-lg">{tramites.length} REGISTROS</p>
        </div>
     </div>
     <TramitesListView tramites={tramites} onSelect={() => {}} />
  </div>
);

export default App;







