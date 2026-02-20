
import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import { 
  Role, 
  EstatusWorkflow, 
  Tramite, 
  TipoBeneficiario, 
  User,
  Bitácora
} from './types';
import { dbService, ensureSession, loginWithMatricula, logoutSession, adminCreateCapturista, adminResetPassword, changeOwnPassword, AuthError, validatePasswordStrength, canAccessTabByRole, canAuthorizeImporte, validateLoginInput, validateNuevoTramiteStep1, validateNuevoTramiteStep2, UX_MESSAGES, TABS_BY_ROLE, SESSION_INVALID_TOKENS } from './services/db';
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
  DollarSign,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { generateFolio } from './utils';
import { COLOR_ESTATUS, TIPOS_CONTRATACION_PERMITIDOS, VIGENCIA_CONSTANCIA_ESTUDIOS_MESES } from './constants';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [presupuestoGlobal, setPresupuestoGlobal] = useState<number>(() => {
    const raw = localStorage.getItem('sistra.presupuestoGlobal');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 800000;
  });
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // EFECTO DE INICIALIZACION: Unico punto de entrada
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
        if (isMounted) setError(e.message || "Fallo en la conexion institucional.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initialize();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    localStorage.setItem('sistra.presupuestoGlobal', String(presupuestoGlobal));
  }, [presupuestoGlobal]);

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
    { name: 'Revision', value: stats.pendientes },
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
    setUserMenuOpen(false);
    setShowChangePasswordModal(false);
    setUiMessage('sesión cerrada correctamente.');
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
      await dbService.addBitácora({
        tramiteId: newId,
        usuario: user.nombre,
        accion: 'CREACION CLOUD',
        descripcion: `Tramite ${newTramite.folio} creado exitosamente.`
      });
      await loadData();
      setActiveTab('tramites');
    } catch (e: any) {
      if (isSessionInvalidError(e)) {
        forceLogoutWithMessage(UX_MESSAGES.SESSION_INVALID);
        return;
      }
      setUiMessage(e?.message || 'No fue posible guardar el tramite.');
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
        updateData.firmaAutorizacion = `AUTORIZADO ELECTRONICAMENTE POR ${user.nombre}`;
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

    const fechaAutorizacion = new Date().toISOString();
    let metadata: PrintMetadata = {
      folio: selectedTramite.folio,
      documento: type,
      emision: 'ORIGINAL',
      autorizadoPor: selectedTramite.nombreAutorizador || user.nombre,
      fechaAutorizacion
    };

    try {
      const BitácoraActual = await dbService.getBitácora(selectedTramite.id);
      const impresionesPrevias = BitácoraActual.filter(
        (b) => b.categoria === 'IMPRESION' && b.datos?.documento === type
      ).length;

      const esReimpresion = impresionesPrevias > 0;
      let motivoReimpresion: string | undefined;

      if (esReimpresion) {
        const motivo = window.prompt('Este documento ya fue impreso. Captura el motivo de reimpresion (obligatorio):', '');
        if (!motivo || !motivo.trim()) {
          alert('La reimpresion requiere motivo obligatorio.');
          return;
        }
        motivoReimpresion = motivo.trim();
      }

      metadata = {
        ...metadata,
        emision: esReimpresion ? 'REIMPRESION' : 'ORIGINAL',
        motivoReimpresion
      };

      // abrir vista de impresion aunque falle la Bitácora
      setPrintConfig({ show: true, type, metadata });

      await dbService.addBitácora({
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
    } catch (e: any) {
      if (isSessionInvalidError(e)) {
        forceLogoutWithMessage(UX_MESSAGES.SESSION_INVALID);
        return;
      }
      // fallback: permitir impresion aunque falle registro secundario
      setPrintConfig({ show: true, type, metadata });
      setUiMessage('Se abrio la vista de impresion, pero fallo el registro en Bitácora.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCapture = async (tramite: Tramite) => {
    const nombre = window.prompt('Nombre(s) del beneficiario:', tramite.beneficiario?.nombre || '');
    if (nombre === null) return;
    const apellidoPaterno = window.prompt('Apellido paterno:', tramite.beneficiario?.apellidoPaterno || '');
    if (apellidoPaterno === null) return;
    const apellidoMaterno = window.prompt('Apellido materno:', tramite.beneficiario?.apellidoMaterno || '');
    if (apellidoMaterno === null) return;
    const nss = window.prompt('NSS titular:', tramite.beneficiario?.nssTrabajador || '');
    if (nss === null) return;
    const nssHijo = window.prompt('NSS hija/hijo:', tramite.beneficiario?.nssHijo || '');
    if (nssHijo === null) return;
    const titularNombreCompleto = window.prompt('Nombre completo de persona titular:', tramite.beneficiario?.titularNombreCompleto || '');
    if (titularNombreCompleto === null) return;
    const fechaNacimiento = window.prompt('Fecha de nacimiento (YYYY-MM-DD):', tramite.beneficiario?.fechaNacimiento ? String(tramite.beneficiario.fechaNacimiento).slice(0, 10) : '');
    if (fechaNacimiento === null) return;
    const entidadLaboral = window.prompt('Unidad/adscripcion laboral:', tramite.beneficiario?.entidadLaboral || '');
    if (entidadLaboral === null) return;
    const ooad = window.prompt('OOAD:', tramite.beneficiario?.ooad || '');
    if (ooad === null) return;
    const matricula = window.prompt('Matricula:', tramite.beneficiario?.matricula || '');
    if (matricula === null) return;
    const claveAdscripcion = window.prompt('Clave adscripcion:', tramite.beneficiario?.claveAdscripcion || '');
    if (claveAdscripcion === null) return;
    const tipoContratacion = window.prompt('Tipo de contratacion:', tramite.beneficiario?.tipoContratacion || '');
    if (tipoContratacion === null) return;
    const constanciaEstudiosVigente = window.prompt('Constancia de estudios vigente (SI/NO):', tramite.beneficiario?.constanciaEstudiosVigente ? 'SI' : 'NO');
    if (constanciaEstudiosVigente === null) return;
    const fechaConstanciaEstudios = window.prompt('Fecha constancia (YYYY-MM-DD):', tramite.beneficiario?.fechaConstanciaEstudios ? String(tramite.beneficiario.fechaConstanciaEstudios).slice(0, 10) : '');
    if (fechaConstanciaEstudios === null) return;
    const contratoColectivoAplicable = window.prompt('Contrato colectivo aplicable (obligatorio):', tramite.contratoColectivoAplicable || '');
    if (contratoColectivoAplicable === null) return;

    const folioReceta = window.prompt('Folio de receta:', tramite.folioRecetaImss || '');
    if (folioReceta === null) return;
    const fechaExpedicionReceta = window.prompt('Fecha expedicion receta (YYYY-MM-DD):', tramite.fechaExpedicionReceta ? String(tramite.fechaExpedicionReceta).slice(0, 10) : '');
    if (fechaExpedicionReceta === null) return;
    const descripcion = window.prompt('Diagnostico/descripcion de lente:', tramite.descripcionLente || '');
    if (descripcion === null) return;
    const medicionAnteojos = window.prompt('Medicion de anteojos:', tramite.medicionAnteojos || '');
    if (medicionAnteojos === null) return;
    const qnaInclusion = window.prompt('Qna/Periodo de inclusion:', tramite.qnaInclusion || '');
    if (qnaInclusion === null) return;
    const fechaRecepcionOptica = window.prompt('Fecha recepcion optica (YYYY-MM-DD):', tramite.fechaRecepcionOptica ? String(tramite.fechaRecepcionOptica).slice(0, 10) : '');
    if (fechaRecepcionOptica === null) return;
    const fechaEntregaOptica = window.prompt('Fecha entrega optica (YYYY-MM-DD):', tramite.fechaEntregaOptica ? String(tramite.fechaEntregaOptica).slice(0, 10) : '');
    if (fechaEntregaOptica === null) return;

    setLoading(true);
    try {
      await dbService.saveTramite({
        id: tramite.id,
        contratoColectivoAplicable: contratoColectivoAplicable.trim(),
        beneficiario: {
          ...tramite.beneficiario,
          nombre: nombre.trim(),
          apellidoPaterno: apellidoPaterno.trim(),
          apellidoMaterno: apellidoMaterno.trim(),
          nssTrabajador: String(nss).replace(/\D/g, '').slice(0, 11),
          nssHijo: String(nssHijo).replace(/\D/g, '').slice(0, 11),
          titularNombreCompleto: titularNombreCompleto.trim(),
          fechaNacimiento: fechaNacimiento.trim(),
          entidadLaboral: entidadLaboral.trim(),
          ooad: ooad.trim(),
          matricula: matricula.trim(),
          claveAdscripcion: claveAdscripcion.trim(),
          tipoContratacion: tipoContratacion.trim(),
          constanciaEstudiosVigente: String(constanciaEstudiosVigente).trim().toUpperCase() === 'SI',
          fechaConstanciaEstudios: fechaConstanciaEstudios.trim()
        },
        folioRecetaImss: folioReceta.trim(),
        fechaExpedicionReceta: fechaExpedicionReceta.trim() ? new Date(fechaExpedicionReceta.trim()).toISOString() : '',
        descripcionLente: descripcion.trim(),
        medicionAnteojos: (medicionAnteojos || '').trim(),
        qnaInclusion: qnaInclusion.trim(),
        fechaRecepcionOptica: fechaRecepcionOptica.trim() ? new Date(fechaRecepcionOptica.trim()).toISOString() : '',
        fechaEntregaOptica: fechaEntregaOptica.trim() ? new Date(fechaEntregaOptica.trim()).toISOString() : ''
      } as Partial<Tramite>);
      await dbService.addBitácora({
        tramiteId: tramite.id,
        usuario: user.nombre,
        accion: 'EDICION_CAPTURA_COMPLETA',
        categoria: 'WORKFLOW',
        descripcion: `Captura actualizada de forma integral para folio ${tramite.folio}.`
      });
      await loadData();
      setUiMessage('Captura actualizada correctamente.');
    } catch (e: any) {
      setUiMessage(e?.message || 'No se pudo actualizar la captura.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTramite = async (tramite: Tramite) => {
    if (!user) return;
    const confirmed = window.confirm(`Se eliminara la solicitud ${tramite.folio}. Esta accion no se puede deshacer. ¿Deseas continuar?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      await dbService.addBitácora({
        tramiteId: tramite.id,
        usuario: user.nombre,
        accion: 'ELIMINACION_SOLICITUD',
        categoria: 'WORKFLOW',
        descripcion: `Solicitud ${tramite.folio} marcada para eliminacion por ${user.nombre}.`
      });
      await dbService.deleteTramite(tramite.id);
      setSelectedTramite(null);
      await loadData();
      setUiMessage('Solicitud eliminada correctamente.');
    } catch (e: any) {
      setUiMessage(e?.message || 'No se pudo eliminar la solicitud.');
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
        <p className="text-imss-gold/60 mt-4 font-bold text-xs">INICIALIZANDO sesión SEGURA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl max-w-lg border border-red-100 text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-6" size={64} />
          <h2 className="text-2xl font-black text-slate-800 uppercase mb-4">Error de Sincronizacion</h2>
          <p className="text-slate-600 mb-8">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-imss text-white font-black uppercase rounded-2xl">Reintentar</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} loading={loading} error={error} infoMessage={uiMessage} />;
  }

  // VISTA DE IMPRESION (Separada del flujo principal para evitar fugas de memoria)
  if (printConfig.show && selectedTramite) {
    return (
      <div className="bg-white p-0">
        <div className="no-print p-4 bg-imss-dark text-white flex justify-between items-center sticky top-0 z-50">
          <button onClick={() => setPrintConfig({show: false, type: 'formato'})} className="flex items-center gap-2 font-bold uppercase text-xs">
            <ArrowLeft size={16} /> Volver al Sistema
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="bg-imss px-6 py-2 rounded-xl flex items-center gap-2 font-black uppercase text-xs border border-white/20">
              <Printer size={16} /> Imprimir Documento
            </button>
            <button onClick={() => window.print()} className="bg-white/10 px-6 py-2 rounded-xl flex items-center gap-2 font-black uppercase text-xs border border-white/20">
              <FileText size={16} /> Descargar PDF
            </button>
          </div>
        </div>
        <div className="print-stage print-container py-4 bg-slate-100 min-h-screen">
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
               <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest">En Linea (v2.7)</p>
            </div>
          </div>

          <nav className="mobile-scroll-x flex-1 px-3 lg:px-4 lg:space-y-2 mt-2 lg:mt-6 flex lg:block gap-2">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Tablero" active={activeTab === 'dashboard'} onClick={() => goToTab('dashboard')} />
            <SidebarItem icon={<Search size={20} />} label="Bandeja" active={activeTab === 'tramites'} onClick={() => goToTab('tramites')} />
            {canAccessTab('nuevo') && (
              <SidebarItem icon={<PlusCircle size={20} />} label="Nueva Captura" active={activeTab === 'nuevo'} onClick={() => goToTab('nuevo')} />
            )}
            {/* vista central deshabilitada por requerimiento operativo */}
            {canAccessTab('adminUsers') && (
              <SidebarItem icon={<Settings size={20} />} label="Usuarios" active={activeTab === 'adminUsers'} onClick={() => goToTab('adminUsers')} />
            )}
          </nav>

          <div className="hidden lg:block p-6 border-t border-white/5">
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-imss flex items-center justify-center text-white font-black border border-imss-gold/40 shadow-inner">
                {user?.nombre?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-white truncate uppercase">{user?.nombre?.split(' ')[0] || 'Usuario'}</p>
                <p className="text-[9px] text-imss-gold font-black truncate uppercase tracking-tighter">{user?.role.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden no-print bg-[#F9FBFC]">
          <header className="min-h-20 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between px-4 py-4 lg:px-10 shadow-sm z-10 gap-3">
            <div className="flex items-center gap-3">
              {activeTab !== 'dashboard' && (
                <button className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase" onClick={() => setActiveTab('dashboard')}>
                  Regresar
                </button>
              )}
              <h2 className="text-base lg:text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                <span className="w-1.5 h-8 bg-imss rounded-full"></span>
                {activeTab === 'dashboard' && 'Resumen Institucional'}
                {activeTab === 'tramites' && 'Gestión de Tramites'}
                {activeTab === 'nuevo' && 'Solicitud de Dotacion'}
                {activeTab === 'central' && 'Gestión de Tramites'}
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

              <div className="relative" ref={userMenuRef}>
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-label="Abrir menu de usuario"
                >
                  <div className="w-8 h-8 rounded-full bg-imss text-white text-xs font-black flex items-center justify-center">
                    {user?.nombre?.charAt(0)}
                  </div>
                  <span className="hidden lg:inline text-xs font-black uppercase text-slate-700 max-w-24 truncate">{user?.nombre}</span>
                  <ChevronDown size={16} className="text-slate-500" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2">
                    <button
                      className="w-full text-left px-3 py-3 text-sm font-bold rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                      onClick={() => {
                        setShowChangePasswordModal(true);
                        setUserMenuOpen(false);
                      }}
                    >
                      <KeyRound size={16} /> Cambiar contraseña
                    </button>
                    <button
                      className="w-full text-left px-3 py-3 text-sm font-bold rounded-xl hover:bg-red-50 text-red-600 flex items-center gap-2"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 lg:p-10">
            {uiMessage && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 px-5 py-4 text-sm font-bold flex items-center justify-between">
                <span>{uiMessage}</span>
                <button className="text-xs uppercase" onClick={() => setUiMessage(null)}>Cerrar</button>
              </div>
            )}
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                chartData={chartData}
                gastoMetrics={gastoMetrics}
                presupuestoGlobal={presupuestoGlobal}
                onUpdatePresupuesto={setPresupuestoGlobal}
              />
            )}
            {activeTab === 'tramites' && <TramitesListView tramites={filteredTramites} onSelect={setSelectedTramite} searchTerm={searchTerm} />}
            {activeTab === 'nuevo' && (canAccessTab('nuevo') ? <NuevoTramiteWizard user={user!} onSave={handleCreateTramite} /> : <AccessDeniedView />)}
            {/* central view removida por operacion */}
            {activeTab === 'adminUsers' && (canAccessTab('adminUsers') ? <AdminUsersView currentUser={user} /> : <AccessDeniedView />)}
          </div>
        </main>

        {showChangePasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowChangePasswordModal(false)}
            onSuccess={(message) => {
              setShowChangePasswordModal(false);
              forceLogoutWithMessage(`${message} Por seguridad inicia sesión nuevamente.`);
            }}
            onAuthFailure={(message) => {
              forceLogoutWithMessage(message);
              setShowChangePasswordModal(false);
            }}
          />
        )}

        {selectedTramite && (
          <TramiteDetailModal 
            tramite={selectedTramite} 
            user={user!}
            onClose={() => setSelectedTramite(null)} 
            onUpdateEstatus={handleUpdateEstatus}
            onEditCapture={handleEditCapture}
            onDeleteTramite={handleDeleteTramite}
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
  const [showPassword, setShowPassword] = useState(false);
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
        <label className="field-label">Matricula</label>
        <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className="field-input mb-5" placeholder="Ej. 99032103" inputMode="numeric" pattern="[0-9]*" required />
        <label className="field-label">contraseña</label>
        <div className="relative mb-6">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input pr-12"
            placeholder="********"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-imss"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {infoMessage && <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold mb-4">{infoMessage}</p>}
        {(localError || error) && <p className="text-red-600 text-sm font-bold mb-4">{localError || error}</p>}
        <button disabled={loading} className="w-full py-4 rounded-xl btn-institutional disabled:opacity-50">
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
        <p className="text-[11px] text-slate-500 mt-4">Acceso con Firebase Auth (matricula + contraseña).</p>
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
  const [role, setRole] = useState<Role>(Role.CAPTURISTA_UNIDAD);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPasswordByUser, setShowResetPasswordByUser] = useState<Record<string, boolean>>({});
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
          <input className="w-full p-3 border rounded-xl" placeholder="Matricula" inputMode="numeric" pattern="[0-9]*" value={matricula} onChange={(e)=>setMatricula(e.target.value.replace(/\D/g, ''))} />
          <input className="w-full p-3 border rounded-xl" placeholder="Unidad" value={unidad} onChange={(e)=>setUnidad(e.target.value)} />
          <input className="w-full p-3 border rounded-xl" placeholder="OOAD" value={ooad} onChange={(e)=>setOoad(e.target.value)} />
          <select className="w-full p-3 border rounded-xl bg-white" value={role} onChange={(e)=>setRole(e.target.value as Role)}>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} className="w-full p-3 border rounded-xl pr-10" placeholder="contraseña inicial" value={password} onChange={(e)=>setPassword(e.target.value)} />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-imss"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button className="w-full py-3 bg-imss text-white rounded-xl font-black uppercase" onClick={async ()=>{
            const issues = validatePasswordStrength(password);
            if (issues.length > 0) {
              setFeedback(`No se puede crear usuario. ${issues.join(' ')}`);
              return;
            }
            try {
              await adminCreateCapturista(currentUser, { nombre, matricula, unidad, ooad, password, role });
              setNombre('');setMatricula('');setUnidad('');setOoad('');setPassword('');setRole(Role.CAPTURISTA_UNIDAD);
              await refresh();
              setFeedback('Usuario creado correctamente.');
            } catch (e: any) { setFeedback(e?.message || 'No se pudo crear el usuario.'); }
          }}>Crear usuario</button>
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
                <div className="relative flex-1">
                  <input
                    type={showResetPasswordByUser[u.id] ? 'text' : 'password'}
                    className="w-full p-2 border rounded-lg pr-9"
                    placeholder="Nueva contraseña"
                    value={resetPasswordByUser[u.id] || ''}
                    onChange={(e)=>setResetPasswordByUser(prev => ({ ...prev, [u.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-imss"
                    onClick={() => setShowResetPasswordByUser(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                    aria-label={showResetPasswordByUser[u.id] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showResetPasswordByUser[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
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
    <p className="font-black text-slate-700 uppercase text-sm">No tienes permisos para ver esta seccion.</p>
    <p className="text-xs text-slate-500 mt-2">Si consideras que es un error, contacta al administrador del sistema.</p>
  </div>
);

const SidebarItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-auto lg:w-full whitespace-nowrap flex items-center gap-3 px-4 lg:px-5 py-3 lg:py-4 rounded-2xl text-xs lg:text-sm font-black uppercase tracking-widest transition-all ${active ? 'bg-imss text-white shadow-xl' : 'hover:bg-white/5 text-imss-light/60 hover:text-white'}`}>
    {icon}{label}
  </button>
);

const DashboardView = ({ stats, chartData, gastoMetrics, presupuestoGlobal, onUpdatePresupuesto }: any) => {
  const avancePct = presupuestoGlobal > 0 ? Math.min(100, (Number(gastoMetrics.global || 0) / presupuestoGlobal) * 100) : 0;
  const semaforo = avancePct >= 90
    ? { label: 'Rojo', badge: 'bg-red-100 text-red-700 border-red-200' }
    : avancePct >= 80
      ? { label: 'Amarillo', badge: 'bg-amber-100 text-amber-700 border-amber-200' }
      : { label: 'Verde', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

  return (
  <div className="space-y-10 animate-in fade-in duration-700">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
      <StatCard label="Total Cloud" value={stats.total} icon={<FileText className="text-imss" />} color="imss" />
      <StatCard label="Por Validar" value={stats.pendientes} icon={<Clock className="text-amber-600" />} color="amber" />
      <StatCard label="Autorizados" value={stats.autorizados} icon={<CheckCircle2 className="text-emerald-600" />} color="emerald" />
      <StatCard label="Entregados" value={stats.entregados} icon={<LogOut className="text-slate-600" />} color="slate" />
      <StatCard label="Gasto Global" value={`$${Number(gastoMetrics.global || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<DollarSign className="text-imss" />} color="imss" />
    </div>

    <div className="bg-white rounded-[32px] border border-slate-100 p-6 lg:p-8 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-end">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Presupuesto global editable</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={presupuestoGlobal}
            onChange={(e) => onUpdatePresupuesto(Number(e.target.value || 0))}
            className="w-full p-3 rounded-xl border-2 border-slate-200 font-black text-imss"
          />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Avance de consumo</p>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-black text-slate-800">{avancePct.toFixed(2)}%</p>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${semaforo.badge}`}>{semaforo.label}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Disponible estimado</p>
          <p className="text-2xl font-black text-emerald-700">${Math.max(0, presupuestoGlobal - Number(gastoMetrics.global || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>
    </div>
    
    <div className="bg-white p-12 rounded-[50px] border border-slate-100 shadow-sm min-h-[500px] flex flex-col">
       <div className="flex items-center justify-between mb-12">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Indicadores de Gestión Nacional</h3>
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-imss rounded-full"></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tramites Activos</span>
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
};

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
      <caption className="sr-only">Bandeja de tramites</caption>
      <thead className="bg-imss-dark">
        <tr>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest">Identificador</th>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest">Solicitante</th>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest text-center">Estatus Cloud</th>
          <th scope="col" className="px-10 py-8 text-[11px] font-black text-white/60 uppercase tracking-widest text-right">Accion</th>
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

const TramiteDetailModal = ({ tramite, user, onClose, onUpdateEstatus, onEditCapture, onDeleteTramite, onPrint, historicalDotations, loading }: any) => {
  const [activeTab, setActiveTab] = useState<'info' | 'Bitácora' | 'tarjeta'>('info');
  const [Bitácora, setBitácora] = useState<Bitácora[]>([]);
  // control de importe se Gestióna fuera de la unidad

  useEffect(() => {
    let isMounted = true;
    const fetchBitácora = async () => {
      try {
        const data = await dbService.getBitácora(tramite.id);
        if (isMounted) setBitácora(data);
      } catch (e) {
        if (isMounted) setBitácora([]);
      }
    };
    fetchBitácora();
    return () => { isMounted = false; };
  }, [tramite.id]);

  const canApprove = false;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-imss-dark/80 backdrop-blur-xl z-50 flex items-center justify-center p-2 lg:p-8 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-label={`Detalle del tramite ${tramite.folio}`}>
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
               <button onClick={() => onPrint('formato')} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-3 text-xs font-black uppercase tracking-widest border border-white/5">
                 <Printer size={20} className="text-imss-gold" /> Imprimir/Reimprimir 027
               </button>
               <button onClick={() => onPrint('tarjeta')} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all flex items-center gap-3 text-xs font-black uppercase tracking-widest border border-white/5">
                 <CreditCard size={20} className="text-imss-gold" /> Imprimir/Reimprimir 028
               </button>
               <button onClick={() => onEditCapture(tramite)} className="px-6 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-white/5">
                 Editar captura
               </button>
               <button onClick={() => onDeleteTramite(tramite)} className="px-6 py-4 bg-red-500/20 hover:bg-red-500/35 rounded-2xl transition-all text-xs font-black uppercase tracking-widest border border-red-200/30 text-red-100">
                 Eliminar solicitud
               </button>
               <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/20 rounded-2xl text-white/40 hover:text-white transition-all">
                 <XCircle size={32} />
               </button>
             </div>
          </div>

          <div className="mobile-scroll-x flex border-b border-slate-100 bg-slate-50 px-2 lg:px-12">
             <TabButton label="Información General" active={activeTab === 'info'} onClick={() => setActiveTab('info')} />
             <TabButton label="Historial Institucional" active={activeTab === 'tarjeta'} onClick={() => setActiveTab('tarjeta')} />
             <TabButton label="Bitácora Cloud" active={activeTab === 'Bitácora'} onClick={() => setActiveTab('Bitácora')} />
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-12 bg-white">
            {/* impresion/reimpresion habilitada desde captura completada */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
                <div className="space-y-10">
                  <div className="p-10 bg-slate-50 rounded-[40px] border border-slate-100 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase mb-8 tracking-[0.2em]">Cedula del Beneficiario</h4>
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
                    <h4 className="text-[11px] font-black text-imss/50 uppercase tracking-[0.2em]">Control normativo</h4>
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contrato colectivo aplicable</p>
                      <p className="text-sm font-black text-slate-800">{tramite.contratoColectivoAplicable || 'SIN CAPTURA'}</p>
                      <p className="text-[10px] text-slate-500 font-bold">Dotaciones registradas para este contrato: {historicalDotations.filter((d: Tramite) => String(d.contratoColectivoAplicable || '').trim().toUpperCase() === String(tramite.contratoColectivoAplicable || '').trim().toUpperCase()).length} de 2</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medicion de anteojos</p>
                      <p className="text-sm font-bold text-slate-800">{tramite.medicionAnteojos?.trim() ? tramite.medicionAnteojos : 'Sin medicion capturada. Se permite impresion para llenado manual.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Bitácora' && (
              <div className="space-y-6">
                 {Bitácora.length > 0 ? Bitácora.map((b) => (
                   <div key={b.id} className="p-6 bg-slate-50 border-l-[6px] border-imss rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <p className="font-black text-imss-dark text-sm uppercase">{b.accion}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(b.fecha).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed mb-2">{b.descripcion}</p>
                      {b.categoria && (
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Categoria: {b.categoria}</p>
                      )}
                      {b.datos?.folio && (
                        <p className="text-[10px] font-bold text-slate-500 mb-4">
                          Folio: {b.datos.folio} · Emision: {b.datos.emision || 'N/A'} · Documento: {b.datos.documento || 'N/A'}
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

const ChangePasswordModal = ({ onClose, onSuccess, onAuthFailure }: {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onAuthFailure: (message: string) => void;
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const strengthIssues = useMemo(() => validatePasswordStrength(newPassword), [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword.trim()) {
      setFeedback('Captura tu contraseña actual para continuar.');
      return;
    }

    if (strengthIssues.length > 0) {
      setFeedback(`La nueva contraseña no cumple la politica: ${strengthIssues.join(' ')}`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback('La confirmacion no coincide con la nueva contraseña.');
      return;
    }

    if (currentPassword === newPassword) {
      setFeedback('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    setSubmitting(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      onSuccess('contraseña actualizada correctamente. Usa la nueva contraseña en tu proximo inicio de sesión.');
    } catch (error: any) {
      if (error instanceof AuthError && (error.code === 'INVALID_CREDENTIALS' || error.code === 'INVALID_SESSION')) {
        onAuthFailure('No fue posible reautenticar tu identidad. Por seguridad se cerro tu sesión. Inicia de nuevo.');
        return;
      }

      setFeedback(error?.message || 'No se pudo cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Cambiar contraseña</h3>
          <button className="text-xs font-bold uppercase text-slate-500 hover:text-slate-800" onClick={onClose} disabled={submitting}>Cerrar</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="field-label">contraseña actual</label>
            <div className="relative">
              <input type={showCurrentPassword ? 'text' : 'password'} className="field-input pr-12" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-imss" onClick={() => setShowCurrentPassword((prev) => !prev)} aria-label={showCurrentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Nueva contraseña</label>
            <div className="relative">
              <input type={showNewPassword ? 'text' : 'password'} className="field-input pr-12" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-imss" onClick={() => setShowNewPassword((prev) => !prev)} aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-[11px]">
              {[
                { ok: newPassword.length >= 10, text: 'Minimo 10 caracteres' },
                { ok: /[A-Z]/.test(newPassword), text: 'Al menos una mayuscula' },
                { ok: /[a-z]/.test(newPassword), text: 'Al menos una minuscula' },
                { ok: /\d/.test(newPassword), text: 'Al menos un numero' },
                { ok: /[^A-Za-z0-9]/.test(newPassword), text: 'Al menos un caracter especial' }
              ].map((rule) => (
                <li key={rule.text} className={rule.ok ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                  {rule.ok ? 'OK' : '-'} {rule.text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="field-label">Confirmar nueva contraseña</label>
            <div className="relative">
              <input type={showConfirmPassword ? 'text' : 'password'} className="field-input pr-12" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-imss" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {feedback && <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{feedback}</p>}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold" disabled={submitting}>Cancelar</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-imss text-white text-sm font-black disabled:opacity-50" disabled={submitting}>
              {submitting ? 'Actualizando...' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
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
    nssHijo: '',
    titularNombreCompleto: '',
    matricula: '',
    claveAdscripcion: '',
    tipoContratacion: '',
    fechaNacimiento: '',
    fechaConstanciaEstudios: '',
    constanciaEstudiosVigente: false,
    requiereConstanciaEstudios: false,
    entidadLaboral: user.unidad,
    ooad: user.ooad
  });
  const [receta, setReceta] = useState({ folio: '', descripcion: '', medicionAnteojos: '', contratoColectivoAplicable: '', qnaInclusion: '', fechaExpedicionReceta: '', dotacionNo: 1 });

  const edadBeneficiario = useMemo(() => {
    if (!beneficiario.fechaNacimiento) return null;
    const nacimiento = new Date(beneficiario.fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1;
    return edad;
  }, [beneficiario.fechaNacimiento]);

  const requiereConstanciaEstudios = beneficiario.tipo === TipoBeneficiario.HIJO && (edadBeneficiario ?? 0) >= 16;

  useEffect(() => {
    setBeneficiario((prev: any) => ({ ...prev, requiereConstanciaEstudios }));
  }, [requiereConstanciaEstudios]);

  const validateStep1 = () => {
    const baseError = validateNuevoTramiteStep1({
      nombre: beneficiario.nombre,
      nssTrabajador: beneficiario.nssTrabajador
    });
    if (baseError) return baseError;

    if (!beneficiario.apellidoPaterno?.trim()) return 'Captura apellido paterno del beneficiario.';
    if (!beneficiario.apellidoMaterno?.trim()) return 'Captura apellido materno del beneficiario.';
    if (!beneficiario.entidadLaboral?.trim()) return 'Captura la unidad o adscripcion laboral.';

    if (beneficiario.tipo === TipoBeneficiario.TRABAJADOR || beneficiario.tipo === TipoBeneficiario.JUBILADO_PENSIONADO) {
      if (!beneficiario.matricula?.trim()) return 'Captura la matricula para trabajador o jubilado/pensionado.';
      if (!beneficiario.claveAdscripcion?.trim()) return 'Captura la clave de adscripcion.';
      if (!beneficiario.tipoContratacion?.trim()) return 'Selecciona tipo de contratacion.';
    }

    if (beneficiario.tipo === TipoBeneficiario.HIJO) {
      if (!beneficiario.titularNombreCompleto?.trim()) return 'Captura nombre completo de la persona trabajadora titular.';
      if (!beneficiario.nssHijo?.trim() || !/^\d{10,11}$/.test(beneficiario.nssHijo.trim())) return 'El NSS de hija/hijo debe tener 10 u 11 digitos.';
      if (!beneficiario.fechaNacimiento) return 'Captura fecha de nacimiento de hija/hijo.';
      if (requiereConstanciaEstudios) {
        if (!beneficiario.constanciaEstudiosVigente) return 'Marca constancia de estudios vigente para hija/hijo (16 anos o mas).';
        if (!beneficiario.fechaConstanciaEstudios) return 'Captura fecha de emision de constancia de estudios.';
      }
    }

    return '';
  };

  const validateStep2 = () => {
    const step2Error = validateNuevoTramiteStep2({
      folioRecetaImss: receta.folio,
      descripcionLente: receta.descripcion
    });
    if (step2Error) return step2Error;
    if (!receta.contratoColectivoAplicable?.trim()) return 'Captura el contrato colectivo aplicable.';
    if (!receta.qnaInclusion?.trim()) return 'Captura la Qna/Mes de inclusion.';
    if (!receta.fechaExpedicionReceta) return 'Captura la fecha de expedicion de receta.';
    return '';
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
    const validationError = step === 1 ? validateStep1() : validateStep2();
    if (validationError) {
      setStepError(validationError);
      setStep(step === 1 ? 1 : 2);
      return;
    }

    const titularNombre = beneficiario.tipo === TipoBeneficiario.HIJO
      ? beneficiario.titularNombreCompleto
      : `${beneficiario.nombre} ${beneficiario.apellidoPaterno} ${beneficiario.apellidoMaterno}`.trim();

    const tramite: Tramite = {
      id: '',
      folio: generateFolio(user.unidad, Math.floor(Math.random() * 1000)),
      beneficiario: {
        ...beneficiario,
        titularNombreCompleto: titularNombre,
        constanciaEstudiosVigente: Boolean(beneficiario.constanciaEstudiosVigente),
        requiereConstanciaEstudios
      },
      contratoColectivoAplicable: receta.contratoColectivoAplicable.trim(),
      fechaCreacion: new Date().toISOString(),
      creadorId: user.id,
      unidad: user.unidad,
      estatus: EstatusWorkflow.EN_REVISION_DOCUMENTAL,
      dotacionNumero: receta.dotacionNo,
      requiereDictamenMedico: receta.dotacionNo >= 3,
      importeSolicitado: 0,
      folioRecetaImss: receta.folio,
      fechaExpedicionReceta: new Date(receta.fechaExpedicionReceta).toISOString(),
      descripcionLente: receta.descripcion,
      medicionAnteojos: receta.medicionAnteojos.trim(),
      qnaInclusion: receta.qnaInclusion.trim(),
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
              {s === 1 ? 'Solicitante' : s === 2 ? 'Medico' : 'Finalizar'}
            </span>
          </div>
        ))}
      </div>
      <div className="p-20">
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
          Antes de capturar, valida en ventanilla: receta IMSS vigente, identificacion oficial y (si aplica) constancia de estudios para hija/hijo.
        </div>
        {stepError && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold" role="alert">
            {stepError}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Tipo de beneficiario</label>
                <select className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                  value={beneficiario.tipo}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, tipo: e.target.value as TipoBeneficiario }); }}>
                  <option value={TipoBeneficiario.TRABAJADOR}>Trabajador(a)</option>
                  <option value={TipoBeneficiario.HIJO}>Hija/Hijo</option>
                  <option value={TipoBeneficiario.JUBILADO_PENSIONADO}>Jubilado/Pensionado</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Unidad / adscripcion</label>
                <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                  value={beneficiario.entidadLaboral}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, entidadLaboral: e.target.value }); }} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">OOAD</label>
                <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                  value={beneficiario.ooad}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, ooad: e.target.value }); }} />
              </div>

              {beneficiario.tipo === TipoBeneficiario.HIJO && (
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Nombre completo de la persona titular (trabajador/a)</label>
                  <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black uppercase text-slate-800"
                    value={beneficiario.titularNombreCompleto}
                    onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, titularNombreCompleto: e.target.value }); }} />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">{beneficiario.tipo === TipoBeneficiario.HIJO ? 'Nombre(s) de hija/hijo beneficiario' : 'Nombre(s) del beneficiario'}</label>
                <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black uppercase text-slate-800"
                  value={beneficiario.nombre}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, nombre: e.target.value }); }} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Apellido paterno</label>
                <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black uppercase text-slate-800"
                  value={beneficiario.apellidoPaterno}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, apellidoPaterno: e.target.value }); }} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Apellido materno</label>
                <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black uppercase text-slate-800"
                  value={beneficiario.apellidoMaterno}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, apellidoMaterno: e.target.value }); }} />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">NSS titular</label>
                <input inputMode="numeric" maxLength={11} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-imss text-xl tracking-[0.2em]"
                  value={beneficiario.nssTrabajador}
                  onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, nssTrabajador: e.target.value.replace(/\D/g, '') }); }} />
              </div>

              {beneficiario.tipo === TipoBeneficiario.HIJO && (
                <>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">NSS hija/hijo</label>
                    <input inputMode="numeric" maxLength={11} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-imss text-xl tracking-[0.2em]"
                      value={beneficiario.nssHijo}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, nssHijo: e.target.value.replace(/\D/g, '') }); }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Fecha de nacimiento</label>
                    <input type="date" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                      value={beneficiario.fechaNacimiento}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, fechaNacimiento: e.target.value }); }} />
                  </div>
                </>
              )}

              {(beneficiario.tipo === TipoBeneficiario.TRABAJADOR || beneficiario.tipo === TipoBeneficiario.JUBILADO_PENSIONADO) && (
                <>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Matricula</label>
                    <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                      value={beneficiario.matricula}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, matricula: e.target.value }); }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Clave adscripcion</label>
                    <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                      value={beneficiario.claveAdscripcion}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, claveAdscripcion: e.target.value }); }} />
                    <p className="mt-2 text-[11px] font-bold text-amber-700">Aviso OOAD: se debera verificar que la adscripcion se encuentre dentro del OOAD, toda vez que el contrato de anteojos esta formalizado por estado y no aplica para usuarios de otros OOAD o estados.</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Tipo de contratacion</label>
                    <select className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss font-black text-slate-800"
                      value={beneficiario.tipoContratacion}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, tipoContratacion: e.target.value }); }}>
                      <option value="">Selecciona...</option>
                      {TIPOS_CONTRATACION_PERMITIDOS.map((t) => <option key={t.code} value={t.label}>{t.code} - {t.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {beneficiario.tipo === TipoBeneficiario.HIJO && requiereConstanciaEstudios && (
                <div className="md:col-span-2 p-6 rounded-3xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-3">Constancia de estudios requerida (16+ anos)</p>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="checkbox" checked={Boolean(beneficiario.constanciaEstudiosVigente)}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, constanciaEstudiosVigente: e.target.checked }); }} />
                    <span className="text-sm font-bold text-slate-700">Se presento constancia de estudios vigente</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-2 tracking-widest">Fecha constancia</label>
                    <input type="date" className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-imss font-black text-slate-700"
                      value={beneficiario.fechaConstanciaEstudios}
                      onChange={(e) => { setStepError(''); setBeneficiario({ ...beneficiario, fechaConstanciaEstudios: e.target.value }); }} />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">Vigencia maxima de referencia: {VIGENCIA_CONSTANCIA_ESTUDIOS_MESES} meses.</p>
                </div>
              )}
            </div>
            <button onClick={() => goToStep(2)} className="w-full py-7 bg-imss text-white rounded-[32px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-imss-dark transition-all">Siguiente Fase</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Folio de Receta 1A14</label>
              <input placeholder="FOLIO RECETA" aria-label="Folio de receta" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={receta.folio} onChange={(e) => { setStepError(''); setReceta({ ...receta, folio: e.target.value }); }} />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Diagnostico y Especificacion</label>
              <textarea placeholder="DESCRIBA LA GRADUACION..." aria-label="Diagnostico y especificacion" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl h-44 outline-none focus:border-imss transition-all font-bold uppercase text-slate-800 shadow-inner" value={receta.descripcion} onChange={(e) => { setStepError(''); setReceta({ ...receta, descripcion: e.target.value }); }} />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Contrato colectivo aplicable (obligatorio)</label>
              <input placeholder="Ej. CCT-IMSS/2026-P1" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={receta.contratoColectivoAplicable} onChange={(e) => { setStepError(''); setReceta({ ...receta, contratoColectivoAplicable: e.target.value }); }} />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Qna/Mes inclusion</label>
              <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black uppercase text-slate-800 shadow-inner" value={receta.qnaInclusion} onChange={(e) => { setStepError(''); setReceta({ ...receta, qnaInclusion: e.target.value }); }} />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Fecha expedicion de receta</label>
              <input type="date" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-black text-slate-800 shadow-inner" value={receta.fechaExpedicionReceta} onChange={(e) => { setStepError(''); setReceta({ ...receta, fechaExpedicionReceta: e.target.value }); }} />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest">Medicion de anteojos (opcional)</label>
              <input placeholder="Puede dejarse vacio" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-imss transition-all font-bold text-slate-800 shadow-inner" value={receta.medicionAnteojos} onChange={(e) => { setStepError(''); setReceta({ ...receta, medicionAnteojos: e.target.value }); }} />
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
            <h3 className="text-4xl font-black text-slate-800 uppercase mb-6 tracking-tighter">Validacion de Registro</h3>
            <p className="text-slate-500 mb-14 max-w-md mx-auto font-medium leading-relaxed uppercase text-xs tracking-widest">La solicitud sera firmada digitalmente y registrada en el sistema institucional.</p>
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
           <p className="text-imss-gold font-black text-xs uppercase tracking-[0.4em] mt-3">Gestión de Auditoria y Control Fiscal</p>
        </div>
        <div className="bg-white/10 px-8 py-5 rounded-[24px] backdrop-blur-md border border-white/5">
           <p className="text-white font-black text-lg">{tramites.length} REGISTROS</p>
        </div>
     </div>
     <TramitesListView tramites={tramites} onSelect={() => {}} />
  </div>
);

export default App;









