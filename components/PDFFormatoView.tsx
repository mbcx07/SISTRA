
import React from 'react';
import { Tramite, TipoBeneficiario } from '../types';

interface PDFFormatoViewProps {
  tramite: Tramite;
}

export const PDFFormatoView: React.FC<PDFFormatoViewProps> = ({ tramite }) => {
  const b = tramite.beneficiario;

  const checkbox = (checked: boolean) => (
    <div className={`w-8 h-8 border-2 border-black flex items-center justify-center font-bold text-lg ${checked ? 'bg-white' : ''}`}>
      {checked ? 'X' : ''}
    </div>
  );

  return (
    <div className="bg-white p-10 w-[215.9mm] min-h-[279.4mm] mx-auto text-[11px] font-sans uppercase print-container text-black">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white flex items-center justify-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/74/IMSS_Logo.svg" alt="IMSS" className="w-full" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[16px] font-bold leading-tight">INSTITUTO MEXICANO DEL SEGURO SOCIAL</h1>
            <h2 className="text-[14px] font-bold leading-tight">FORMATO TRÁMITE DE ANTEOJOS</h2>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          <span className="font-bold">RECETA N°:</span>
          <div className="border-b border-black min-w-[120px] text-center font-bold text-sm">
            {tramite.folioRecetaImss}
          </div>
        </div>
      </div>

      {/* Row 1: Prescripción Para */}
      <div className="flex items-center gap-10 mb-6 mt-8">
        <div className="flex items-center gap-3">
          <span className="font-bold">PRESCRIPCIÓN PARA:</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold">PERSONA TRABAJADORA</span>
          {checkbox(b.tipo === TipoBeneficiario.TRABAJADOR)}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold">HIJA/HIJO</span>
          {checkbox(b.tipo === TipoBeneficiario.HIJO)}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold text-right leading-tight">PERSONA JUBILADA /<br/>PENSIONADA</span>
          {checkbox(b.tipo === TipoBeneficiario.JUBILADO_PENSIONADO)}
        </div>
      </div>

      {/* Row 2: Lugar, Fecha, Clave */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        <div>
          <span className="font-bold block mb-4">LUGAR:</span>
          <div className="border-b border-black h-8 flex items-end justify-center font-semibold">
            {b.entidadLaboral}
          </div>
        </div>
        <div>
          <span className="font-bold block mb-4">FECHA DE ELABORACIÓN:</span>
          <div className="border-b border-black h-8 flex items-end justify-center font-semibold">
            {new Date(tramite.fechaCreacion).toLocaleDateString()}
          </div>
        </div>
        <div>
          <span className="font-bold block mb-2 leading-tight">CLAVE PRESUPUESTAL DE LA UNIDAD:</span>
          <div className="border-b border-black h-8 flex items-end justify-center font-semibold">
            {tramite.clavePresupuestal}
          </div>
        </div>
      </div>

      {/* Row 3: Nombres */}
      <div className="space-y-6 mb-8">
        <div>
          <span className="font-bold block mb-1">NOMBRE DE LA PERSONA TRABAJADORA, JUBILADA O PENSIONADA:</span>
          <div className="border-b border-black h-8 flex items-end font-semibold px-2">
            {`${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombre}`}
          </div>
        </div>
        <div>
          <span className="font-bold block mb-1">NOMBRE DE LA HIJA/HIJO DE LA PERSONA TRABAJADORA:</span>
          <div className="border-b border-black h-8 flex items-end font-semibold px-2">
            {b.tipo === TipoBeneficiario.HIJO ? b.nombre : 'N/A'}
          </div>
        </div>
      </div>

      {/* Row 4: NSS */}
      <div className="space-y-6 mb-8">
        <div>
          <span className="font-bold block mb-1">No. DE SEGURIDAD SOCIAL DE LA PERSONA TRABAJADORA, JUBILADA O PENSIONADA:</span>
          <div className="border-b border-black h-8 flex items-end font-semibold px-2 text-lg tracking-widest">
            {b.nssTrabajador}
          </div>
        </div>
        <div>
          <span className="font-bold block mb-1">No. DE SEGURIDAD SOCIAL DE LA HIJA/HIJO:</span>
          <div className="border-b border-black h-8 flex items-end font-semibold px-2 text-lg tracking-widest">
            {b.nssHijo || 'N/A'}
          </div>
        </div>
      </div>

      {/* Row 5: Descripción */}
      <div className="mb-8">
        <span className="font-bold block mb-1">DESCRIPCIÓN DEL LENTE:</span>
        <div className="border-b border-black min-h-[60px] flex items-end font-semibold px-2 py-1 leading-relaxed">
          {tramite.descripcionLente}
        </div>
      </div>

      <div className="mb-4">
        <p className="font-bold text-[10px] italic">
          SE AUTORIZA LA PRESCRIPCIÓN DESCRITA A LA PERSONA TRABAJADORA, HIJA O HIJO DE LA PERSONA TRABAJADORA, JUBILADA O PENSIONADA CON:
        </p>
      </div>

      {/* Row 6: Grid de Datos Finales */}
      <div className="grid grid-cols-2 gap-x-20 gap-y-6 mb-12">
        <div className="flex items-center">
          <span className="font-bold w-40">MATRÍCULA:</span>
          <div className="border-b border-black flex-1 text-center font-bold">{b.matricula || 'N/A'}</div>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-40">CLAVE DE ADSCRIPCIÓN:</span>
          <div className="border-b border-black flex-1 text-center font-bold">{b.claveAdscripcion || 'N/A'}</div>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-40">FOLIO RECETA IMSS:</span>
          <div className="border-b border-black flex-1 text-center font-bold">{tramite.folioRecetaImss}</div>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-40">FECHA DE EXPEDICIÓN:</span>
          <div className="border-b border-black flex-1 text-center font-bold">
            {new Date(tramite.fechaExpedicionReceta).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-40">FECHA RECEPCIÓN OPTICA:</span>
          <div className="border-b border-black flex-1 text-center font-bold">
            {tramite.fechaRecepcionOptica ? new Date(tramite.fechaRecepcionOptica).toLocaleDateString() : ''}
          </div>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-40">FECHA ENTREGA OPTICA:</span>
          <div className="border-b border-black flex-1 text-center font-bold">
            {tramite.fechaEntregaOptica ? new Date(tramite.fechaEntregaOptica).toLocaleDateString() : ''}
          </div>
        </div>
      </div>

      {/* Firmas */}
      <div className="grid grid-cols-3 border-2 border-black divide-x-2 divide-black h-48">
        <div className="flex flex-col">
          <div className="p-1 text-center font-bold border-b-2 border-black">AUTORIZACIÓN</div>
          <div className="flex-1 flex flex-col items-center justify-end pb-2">
            <span className="font-bold text-xs border-b border-black w-3/4 text-center mb-1 uppercase">
              {tramite.nombreAutorizador || 'LIC. MOISES BELTRÁN CASTRO'}
            </span>
            <span className="font-bold text-[10px]">FIRMA</span>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="p-1 text-center font-bold border-b-2 border-black text-[9px] leading-tight">
            PERSONA TRABAJADORA, JUBILADA O PENSIONADA
          </div>
          <div className="flex-1 flex flex-col items-center justify-end pb-2">
            <div className="border-b border-black w-3/4 h-1"></div>
            <span className="font-bold text-[10px] mt-1">FIRMA</span>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="p-1 text-center font-bold border-b-2 border-black">RECIBÍ DE CONFORMIDAD</div>
          <div className="flex-1 flex flex-col items-center justify-end pb-2">
            <div className="border-b border-black w-3/4 h-1"></div>
            <span className="font-bold text-[10px] mt-1">FIRMA</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <span className="font-bold text-sm">Clave: 1A14-009-027</span>
      </div>
    </div>
  );
};
