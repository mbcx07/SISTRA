import React from 'react';
import { Tramite, TipoBeneficiario } from '../types';

interface PDFFormatoViewProps {
  tramite: Tramite;
  metadata?: {
    folio: string;
    emision: 'ORIGINAL' | 'REIMPRESION';
    autorizadoPor: string;
    fechaAutorizacion: string;
    motivoReimpresion?: string;
  };
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('es-MX') : 'N/A');
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('es-MX') : 'N/A');

export const PDFFormatoView: React.FC<PDFFormatoViewProps> = ({ tramite, metadata }) => {
  const b = tramite.beneficiario;
  const titularNombre = b.tipo === TipoBeneficiario.HIJO
    ? b.titularNombreCompleto || 'N/A'
    : `${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombre}`.trim();
  const nombreHijo = b.tipo === TipoBeneficiario.HIJO ? `${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombre}`.trim() : 'N/A';

  const checkbox = (checked: boolean) => (
    <div className="w-6 h-6 border border-black flex items-center justify-center font-black text-xs leading-none">
      {checked ? 'X' : ''}
    </div>
  );

  const emision = metadata?.emision || 'ORIGINAL';

  return (
    <div className="print-sheet-letter print-container p-[8mm] text-[10px] font-sans uppercase text-black leading-tight">
      <div className="border border-black p-2 mb-3 text-[9px] bg-white">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <p><strong>Folio de control:</strong> {metadata?.folio || tramite.folio}</p>
          <p><strong>Emision:</strong> {emision}</p>
          <p><strong>Autorizo impresion:</strong> {metadata?.autorizadoPor || tramite.nombreAutorizador || 'N/A'}</p>
          <p><strong>Fecha/Hora:</strong> {formatDateTime(metadata?.fechaAutorizacion)}</p>
        </div>
        {emision === 'REIMPRESION' && (
          <p className="mt-1 font-bold text-red-700"><strong>Motivo reimpresion:</strong> {metadata?.motivoReimpresion || 'N/A'}</p>
        )}
      </div>

      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/74/IMSS_Logo.svg" alt="IMSS" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-[13px] font-black">Instituto Mexicano del Seguro Social</h1>
            <h2 className="text-[12px] font-black">Formato Tramite de Anteojos</h2>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold">Receta No.</p>
          <div className="border-b border-black min-w-[120px] font-black text-sm text-center">{tramite.folioRecetaImss}</div>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-4">
        <span className="font-bold">Prescripcion para:</span>
        <div className="flex items-center gap-2"><span className="font-bold">Trabajador(a)</span>{checkbox(b.tipo === TipoBeneficiario.TRABAJADOR)}</div>
        <div className="flex items-center gap-2"><span className="font-bold">Hija/Hijo</span>{checkbox(b.tipo === TipoBeneficiario.HIJO)}</div>
        <div className="flex items-center gap-2"><span className="font-bold">Jubilada/Pensionada</span>{checkbox(b.tipo === TipoBeneficiario.JUBILADO_PENSIONADO)}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div><p className="font-bold mb-1">Lugar</p><div className="border-b border-black h-6 flex items-end justify-center font-semibold">{b.entidadLaboral}</div></div>
        <div><p className="font-bold mb-1">Fecha elaboracion</p><div className="border-b border-black h-6 flex items-end justify-center font-semibold">{formatDate(tramite.fechaCreacion)}</div></div>
        <div><p className="font-bold mb-1">Clave presupuestal unidad</p><div className="border-b border-black h-6 flex items-end justify-center font-semibold">{tramite.clavePresupuestal}</div></div>
      </div>

      <div className="space-y-3 mb-4">
        <div><p className="font-bold">Nombre persona trabajadora/jubilada/pensionada</p><div className="border-b border-black h-6 flex items-end px-2 font-semibold">{titularNombre}</div></div>
        <div><p className="font-bold">Nombre hija/hijo</p><div className="border-b border-black h-6 flex items-end px-2 font-semibold">{nombreHijo}</div></div>
      </div>

      <div className="space-y-3 mb-4">
        <div><p className="font-bold">NSS persona trabajadora/jubilada/pensionada</p><div className="border-b border-black h-6 flex items-end px-2 font-semibold tracking-widest">{b.nssTrabajador}</div></div>
        <div><p className="font-bold">NSS hija/hijo</p><div className="border-b border-black h-6 flex items-end px-2 font-semibold tracking-widest">{b.nssHijo || 'N/A'}</div></div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
        <div className="flex"><span className="font-bold w-44">Tipo de contratacion:</span><div className="border-b border-black flex-1 text-center font-bold">{b.tipoContratacion || 'N/A'}</div></div>
        <div className="flex"><span className="font-bold w-44">Fecha nacimiento:</span><div className="border-b border-black flex-1 text-center font-bold">{formatDate(b.fechaNacimiento)}</div></div>
        <div className="flex"><span className="font-bold w-44">Constancia de estudios:</span><div className="border-b border-black flex-1 text-center font-bold">{b.requiereConstanciaEstudios ? (b.constanciaEstudiosVigente ? 'VIGENTE' : 'NO PRESENTADA') : 'NO APLICA'}</div></div>
        <div className="flex"><span className="font-bold w-44">Fecha constancia:</span><div className="border-b border-black flex-1 text-center font-bold">{formatDate(b.fechaConstanciaEstudios)}</div></div>
      </div>

      <div className="mb-3">
        <p className="font-bold">Descripcion del lente</p>
        <div className="border border-black min-h-[40px] p-2 font-semibold">{tramite.descripcionLente}</div>
      </div>

      <p className="font-bold text-[9px] mb-2">Se autoriza la prescripcion descrita para la persona beneficiaria indicada.</p>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
        <div className="flex"><span className="font-bold w-36">Matricula:</span><div className="border-b border-black flex-1 text-center font-bold">{b.matricula || 'N/A'}</div></div>
        <div className="flex"><span className="font-bold w-36">Clave adscripcion:</span><div className="border-b border-black flex-1 text-center font-bold">{b.claveAdscripcion || 'N/A'}</div></div>
        <div className="flex"><span className="font-bold w-36">Folio receta IMSS:</span><div className="border-b border-black flex-1 text-center font-bold">{tramite.folioRecetaImss}</div></div>
        <div className="flex"><span className="font-bold w-36">Fecha expedicion:</span><div className="border-b border-black flex-1 text-center font-bold">{formatDate(tramite.fechaExpedicionReceta)}</div></div>
        <div className="flex"><span className="font-bold w-36">Fecha recepcion optica:</span><div className="border-b border-black flex-1 text-center font-bold">{formatDate(tramite.fechaRecepcionOptica)}</div></div>
        <div className="flex"><span className="font-bold w-36">Fecha entrega optica:</span><div className="border-b border-black flex-1 text-center font-bold">{formatDate(tramite.fechaEntregaOptica)}</div></div>
      </div>

      <div className="grid grid-cols-3 border-2 border-black divide-x-2 divide-black h-32">
        <div className="flex flex-col"><div className="p-1 text-center font-bold border-b-2 border-black">Autorizacion</div><div className="flex-1 flex flex-col items-center justify-end pb-2"><span className="font-bold text-[10px] border-b border-black w-4/5 text-center mb-1">{tramite.nombreAutorizador || 'N/A'}</span><span className="font-bold text-[9px]">Firma</span></div></div>
        <div className="flex flex-col"><div className="p-1 text-center font-bold border-b-2 border-black text-[9px]">Persona trabajadora/jubilada/pensionada</div><div className="flex-1 flex flex-col items-center justify-end pb-2"><div className="border-b border-black w-4/5 h-1" /><span className="font-bold text-[9px] mt-1">Firma</span></div></div>
        <div className="flex flex-col"><div className="p-1 text-center font-bold border-b-2 border-black">Recibi de conformidad</div><div className="flex-1 flex flex-col items-center justify-end pb-2"><div className="border-b border-black w-4/5 h-1" /><span className="font-bold text-[9px] mt-1">Firma</span></div></div>
      </div>

      <div className="mt-2 flex justify-between items-center text-[10px]">
        <span className="font-bold">Clave: 1A14-009-027</span>
        {emision === 'REIMPRESION' && <span className="font-black text-red-700">DOCUMENTO REIMPRESO</span>}
      </div>
    </div>
  );
};
