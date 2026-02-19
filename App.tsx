
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Role, 
  EstatusWorkflow, 
  Tramite, 
  TipoBeneficiario, 
  User,
  Bitacora
} from './types';
import { dbService, ensureSession } from './services/db';
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
  LogOut
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tramites' | 'nuevo' | 'central'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [selectedTramite, setSelectedTramite] = useState<Tramite | null>(null);
  const [printConfig, setPrintConfig] = useState<{show: boolean, type: 'formato' | 'tarjeta'}>({show: false, type: 'formato'});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EFECTO DE INICIALIZACIÓN: Único punto de entrada
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Asegurar sesión
        const userProfile = await ensureSession();
        if (!isMounted) return;
        setUser(userProfile);
        
        // 2. Si Auth está roto, no cargamos más pero no crasheamos
        if (userProfile.id === 'AUTH_CONFIG_REQUIRED') {
          setLoading(false);
          return;
        }

        // 3. Cargar datos
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

  const loadData = async () => {
    if (!user || user.id === 'AUTH_CONFIG_REQUIRED') return;
    setLoading(true);
    try {
      const data = await dbService.getTramites();
      setTramites(data || []);
    } catch (e: any) {
      setError("Error al sincronizar con la nube.");
    } finally {
      setLoading(false);
    }
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
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEstatus = async (tramiteId: string, nuevoEstatus: EstatusWorkflow, nota?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const updateData: any = { id: tramiteId, estatus: nuevoEstatus };
      if (nota) updateData.motivoRechazo = nota;
      
      if (nuevoEstatus === EstatusWorkflow.AUTORIZADO) {
        updateData.firmaAutorizacion = `AUTORIZADO ELECTRÓNICAMENTE POR ${user.nombre}`;
        updateData.nombreAutorizador = user.nombre;
      }

      await dbService.saveTramite(updateData);
      await dbService.addBitacora({
        tramiteId,
        usuario: user.nombre,
        accion: 'CAMBIO_ESTATUS',
        descripcion: `Estatus cambiado a ${nuevoEstatus}.`
      });
      await loadData();
      const updated = (await dbService.getTramites()).find(t => t.id === tramiteId);
      if (updated) setSelectedTramite(updated);
    } catch (e: any) {
      alert("Error en actualización.");
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
        <div className="print-container py-10 bg-slate-100 min-h-screen">
           {printConfig.type === 'formato' ? (
             <PDFFormatoView tramite={selectedTramite} />
           ) : (
             <PDFTarjetaControlView 
               beneficiario={selectedTramite.beneficiario} 
               dotaciones={tramites.filter(t => t.beneficiario?.nssTrabajador === selectedTramite.beneficiario?.nssTrabajador)} 
             />
           )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-white">
        {/* Sidebar */}
        <aside className="w-64 bg-imss-dark text-imss-light flex flex-col no-print border-r border-white/5">
          <div className="p-8">
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

          <nav className="flex-1 px-4 space-y-2 mt-6">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Tablero" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <SidebarItem icon={<Search size={20} />} label="Bandeja" active={activeTab === 'tramites'} onClick={() => setActiveTab('tramites')} />
            {user?.role === Role.CAPTURISTA_UNIDAD && (
              <SidebarItem icon={<PlusCircle size={20} />} label="Nueva Captura" active={activeTab === 'nuevo'} onClick={() => setActiveTab('nuevo')} />
            )}
            {(user?.role === Role.CONSULTA_CENTRAL || user?.role === Role.ADMIN_SISTEMA) && (
              <SidebarItem icon={<ClipboardCheck size={20} />} label="Central" active={activeTab === 'central'} onClick={() => setActiveTab('central')} />
            )}
          </nav>

          <div className="p-6 border-t border-white/5">
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
          <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 shadow-sm z-10">
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <span className="w-1.5 h-8 bg-imss rounded-full"></span>
                {activeTab === 'dashboard' && 'Resumen Institucional'}
                {activeTab === 'tramites' && 'Gestión de Trámites'}
                {activeTab === 'nuevo' && 'Solicitud de Dotación'}
                {activeTab === 'central' && 'Auditoría Central'}
              </h2>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-imss transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar NSS o Folio..." 
                  className="pl-12 pr-6 py-3 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold focus:bg-white focus:border-imss outline-none w-80 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {loading && <Loader2 className="animate-spin text-imss" size={24} />}
            </div>
          </header>

          <div className="flex-1 overflow-auto p-10">
            {user?.id === 'AUTH_CONFIG_REQUIRED' && <AuthErrorBanner />}
            {activeTab === 'dashboard' && <DashboardView stats={stats} chartData={chartData} />}
            {activeTab === 'tramites' && <TramitesListView tramites={filteredTramites} onSelect={setSelectedTramite} />}
            {activeTab === 'nuevo' && <NuevoTramiteWizard user={user!} onSave={handleCreateTramite} />}
            {activeTab === 'central' && <CentralView tramites={tramites} />}
          </div>
        </main>

        {selectedTramite && (
          <TramiteDetailModal 
            tramite={selectedTramite} 
            user={user!}
            onClose={() => setSelectedTramite(null)} 
            onUpdateEstatus={handleUpdateEstatus}
            onPrint={(type: 'formato' | 'tarjeta') => setPrintConfig({show: true, type})}
            historicalDotations={tramites.filter(t => t.beneficiario?.nssTrabajador === selectedTramite.beneficiario?.nssTrabajador)}
            loading={loading}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// COMPONENTES AUXILIARES CON GUARDS
const AuthErrorBanner = () => (
  <div className="mb-10 p-8 bg-amber-50 border-2 border-amber-200 rounded-[40px] flex items-start gap-6 animate-in slide-in-from-top-4 shadow-xl">
    <Settings className="text-amber-600 shrink-0" size={40} />
    <div className="flex-1">
      <h3 className="font-black text-amber-800 uppercase text-lg tracking-tight mb-2">Error Crítico: Firebase Auth</h3>
      <p className="text-sm text-amber-700 leading-relaxed font-medium">
        El proveedor de Inicio de Sesión Anónimo no está habilitado en su consola de Firebase. 
        Active esta opción en <strong>Authentication > Sign-in method</strong> para habilitar la persistencia en la nube.
      </p>
      <button onClick={() => window.location.reload()} className="mt-6 px-10 py-3 bg-amber-600 text-white text-xs font-black uppercase rounded-2xl hover:bg-amber-700 transition-all shadow-lg">Refrescar Conexión</button>
    </div>
  </div>
);

const SidebarItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${active ? 'bg-imss text-white shadow-xl' : 'hover:bg-white/5 text-imss-light/50 hover:text-white'}`}>
    {icon}{label}
  </button>
);

const DashboardView = ({ stats, chartData }: any) => (
  <div className="space-y-10 animate-in fade-in duration-700">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      <StatCard label="Total Cloud" value={stats.total} icon={<FileText className="text-imss" />} color="imss" />
      <StatCard label="Por Validar" value={stats.pendientes} icon={<Clock className="text-amber-600" />} color="amber" />
      <StatCard label="Autorizados" value={stats.autorizados} icon={<CheckCircle2 className="text-emerald-600" />} color="emerald" />
      <StatCard label="Entregados" value={stats.entregados} icon={<LogOut className="text-slate-600" />} color="slate" />
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

const TramitesListView = ({ tramites, onSelect }: any) => (
  <div className="bg-white rounded-[50px] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
    <table className="w-full text-left border-collapse">
      <thead className="bg-imss-dark">
        <tr>
          <th className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest">Identificador</th>
          <th className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest">Solicitante</th>
          <th className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest text-center">Estatus Cloud</th>
          <th className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest text-right">Acción</th>
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
              <button className="p-4 bg-slate-100 rounded-2xl text-slate-400 group-hover:bg-imss group-hover:text-white transition-all shadow-sm">
                <ChevronRight size={20} />
              </button>
            </td>
          </tr>
        )) : (
          <tr>
            <td colSpan={4} className="px-10 py-32 text-center text-slate-300 font-black uppercase tracking-[0.3em] opacity-40">Sin registros sincronizados</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const TramiteDetailModal = ({ tramite, user, onClose, onUpdateEstatus, onPrint, historicalDotations, loading }: any) => {
  const [activeTab, setActiveTab] = useState<'info' | 'bitacora' | 'tarjeta'>('info');
  const [bitacora, setBitacora] = useState<Bitacora[]>([]);

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

  const canApprove = (user.role === Role.VALIDADOR_PRESTACIONES || user.role === Role.ADMIN_SISTEMA) && tramite.estatus === EstatusWorkflow.EN_REVISION_DOCUMENTAL;

  return (
    <div className="fixed inset-0 bg-imss-dark/80 backdrop-blur-xl z-50 flex items-center justify-center p-8 animate-in fade-in duration-300">
       <div className="bg-white rounded-[60px] w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/20">
          <div className="px-12 py-10 bg-imss-dark text-white flex justify-between items-center shrink-0 border-b border-imss-gold/20">
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
               <button onClick={() => onPrint('formato')} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-3 text-xs font-black uppercase tracking-widest border border-white/5">
                 <Printer size={20} className="text-imss-gold" /> Formato 027
               </button>
               <button onClick={() => onPrint('tarjeta')} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-3 text-xs font-black uppercase tracking-widest border border-white/5">
                 <CreditCard size={20} className="text-imss-gold" /> Tarjeta 028
               </button>
               <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/20 rounded-2xl text-white/40 hover:text-white transition-all">
                 <XCircle size={32} />
               </button>
             </div>
          </div>

          <div className="flex border-b border-slate-100 bg-slate-50 px-12">
             <TabButton label="Información General" active={activeTab === 'info'} onClick={() => setActiveTab('info')} />
             <TabButton label="Historial Institucional" active={activeTab === 'tarjeta'} onClick={() => setActiveTab('tarjeta')} />
             <TabButton label="Bitácora Cloud" active={activeTab === 'bitacora'} onClick={() => setActiveTab('bitacora')} />
          </div>

          <div className="flex-1 overflow-auto p-12 bg-white">
            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-12">
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
                   <div className="p-10 bg-imss-light/30 rounded-[40px] border border-imss/10">
                    <h4 className="text-[11px] font-black text-imss/50 uppercase mb-8 tracking-[0.2em]">Gestión de Validación</h4>
                    {canApprove ? (
                      <button 
                        disabled={loading} 
                        onClick={() => onUpdateEstatus(tramite.id, EstatusWorkflow.AUTORIZADO)} 
                        className="w-full py-6 bg-imss text-white font-black uppercase text-xs tracking-widest rounded-[24px] hover:bg-imss-dark shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-4"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                        {loading ? 'SINCRONIZANDO...' : 'FIRMAR Y AUTORIZAR'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 text-slate-400 bg-white p-6 rounded-2xl border border-slate-100">
                        <AlertTriangle size={20} />
                        <p className="text-[10px] font-black uppercase tracking-widest">La firma electrónica solo está disponible para validadores autorizados.</p>
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
                      <p className="text-sm text-slate-600 font-medium leading-relaxed mb-4">{b.descripcion}</p>
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
  <button onClick={onClick} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest transition-all border-b-4 ${active ? 'border-imss text-imss bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{label}</button>
);

const NuevoTramiteWizard = ({ user, onSave }: any) => {
  const [step, setStep] = useState(1);
  const [beneficiario, setBeneficiario] = useState<any>({
    tipo: TipoBeneficiario.TRABAJADOR,
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nssTrabajador: '',
    entidadLaboral: user.unidad,
    ooad: user.ooad
  });
  const [receta, setReceta] = useState({ folio: '', descripcion: '', dotacionNo: 1 });

  const handleFinalize = () => {
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
        {step === 1 && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="md:col-span-2">
                 <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Nombre del Beneficiario</label>
                 <input placeholder="NOMBRE COMPLETO" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={beneficiario.nombre} onChange={(e) => setBeneficiario({...beneficiario, nombre: e.target.value})} />
               </div>
               <div>
                 <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">NSS Institucional</label>
                 <input placeholder="0000000000" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black text-imss text-xl tracking-[0.2em] shadow-inner" value={beneficiario.nssTrabajador} onChange={(e) => setBeneficiario({...beneficiario, nssTrabajador: e.target.value})} />
               </div>
             </div>
             <button onClick={() => setStep(2)} className="w-full py-7 bg-imss text-white rounded-[32px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-imss-dark transition-all">Siguiente Fase</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
             <div>
               <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Folio de Receta 1A14</label>
               <input placeholder="FOLIO RECETA" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={receta.folio} onChange={(e) => setReceta({...receta, folio: e.target.value})} />
             </div>
             <div>
               <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Diagnóstico y Especificación</label>
               <textarea placeholder="DESCRIBA LA GRADUACIÓN..." className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl h-44 outline-none focus:border-imss transition-all font-bold uppercase text-slate-800 shadow-inner" value={receta.descripcion} onChange={(e) => setReceta({...receta, descripcion: e.target.value})} />
             </div>
             <div className="flex gap-6">
               <button onClick={() => setStep(1)} className="px-12 py-7 text-slate-400 font-black uppercase tracking-widest hover:text-slate-800 transition-colors">Atrás</button>
               <button onClick={() => setStep(3)} className="flex-1 py-7 bg-imss text-white rounded-[32px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-imss-dark transition-all">Siguiente Fase</button>
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
               <button onClick={() => setStep(2)} className="px-12 py-7 text-slate-400 font-black uppercase tracking-widest hover:text-slate-800 transition-colors">Revisar</button>
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
