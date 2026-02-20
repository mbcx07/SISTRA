import React, { useState } from 'react';
import { Tramite, TipoBeneficiario } from '../types';

interface PDFTarjetaControlViewProps {
  beneficiario: any;
  dotaciones: Tramite[];
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('es-MX') : '');
const valueOrEmpty = (value?: string) => (value || '').trim();

export const PDFTarjetaControlView: React.FC<PDFTarjetaControlViewProps> = ({ beneficiario: b, dotaciones }) => {
  const [logoSrc, setLogoSrc] = useState('/imss-logo.jpg');
  const getDotacionData = (num: number) => dotaciones.find(d => d.dotacionNumero === num);
  const titularNombre = b.tipo === TipoBeneficiario.HIJO
    ? valueOrEmpty(b.titularNombreCompleto)
    : `${valueOrEmpty(b.apellidoPaterno)} ${valueOrEmpty(b.apellidoMaterno)} ${valueOrEmpty(b.nombre)}`.trim();
  const nombreHijo = b.tipo === TipoBeneficiario.HIJO
    ? `${valueOrEmpty(b.apellidoPaterno)} ${valueOrEmpty(b.apellidoMaterno)} ${valueOrEmpty(b.nombre)}`.trim()
    : '';

  const checkbox = (checked: boolean) => (
    <div className="w-6 h-6 border border-black flex items-center justify-center text-xs font-black">{checked ? 'X' : ''}</div>
  );

  const DotacionColumn = ({ num, label }: { num: number; label: string }) => {
    const data = getDotacionData(num);
    return (
      <div className="flex flex-col border-r border-black last:border-r-0">
        <div className="p-1 text-center font-bold border-b border-black text-[9px]">{label}</div>
        <div className="flex-1 flex flex-col divide-y divide-black text-[9px]">
          <div className="h-8 flex items-center justify-center font-bold px-1 text-center">{valueOrEmpty(data?.folioRecetaImss)}</div>
          <div className="h-12 flex items-center justify-center px-1 text-center font-bold leading-tight">{valueOrEmpty(data?.descripcionLente)}</div>
          <div className="h-8 flex items-center justify-center font-bold px-1 text-center">{valueOrEmpty(data?.folio)}</div>
          <div className="h-8 flex items-center justify-center font-bold">{formatDate(data?.fechaCreacion)}</div>
          <div className="h-8 flex items-center justify-center font-bold">{valueOrEmpty(data?.qnaInclusion)}</div>
          <div className="h-14 flex items-end justify-center pb-1 px-1 text-center text-[8px] font-bold">{valueOrEmpty(data?.beneficiario?.nombre)} {valueOrEmpty(data?.beneficiario?.apellidoPaterno)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="print-sheet-letter print-container p-[8mm] text-[10px] font-sans uppercase text-black leading-tight">
      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
        <div className="flex gap-3 items-center">
          <div className="w-12 h-12"><img src={logoSrc} onError={() => setLogoSrc('/imss-logo.svg')} alt="IMSS" className="w-full h-full object-contain" /></div>
          <div>
            <h1 className="text-[12px] font-black">Tarjeta de Control de Dotacion de Anteojos</h1>
            <div className="flex gap-2 items-baseline text-[9px]"><span className="font-bold">OOAD:</span><span className="border-b border-black min-w-[160px] font-bold">{valueOrEmpty(b.ooad)}</span></div>
            <p className="font-bold text-[9px]">Jefatura de Servicios de Desarrollo de Personal</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold">Matricula</p>
          <div className="border-b border-black min-w-[140px] text-center font-black text-sm">{valueOrEmpty(b.matricula)}</div>
        </div>
      </div>

      <div className="mb-3">
        <p className="font-bold mb-1">Se autoriza la dotacion de anteojos a la persona:</p>
        <div className="flex justify-between text-[9px] gap-3">
          <div className="flex items-center gap-1">{checkbox(b.tipo === TipoBeneficiario.TRABAJADOR)}<span className="font-bold">Trabajadora</span></div>
          <div className="flex items-center gap-1">{checkbox(b.tipo === TipoBeneficiario.JUBILADO_PENSIONADO)}<span className="font-bold">Jubilada</span></div>
          <div className="flex items-center gap-1">{checkbox(b.tipo === TipoBeneficiario.PENSIONADA)}<span className="font-bold">Pensionada</span></div>
          <div className="flex items-center gap-1">{checkbox(b.tipo === TipoBeneficiario.HIJO)}<span className="font-bold">Beneficiario(a)</span></div>
        </div>
      </div>

      <div className="space-y-2 mb-3 text-[9px]">
        <div className="flex gap-2 items-baseline"><span className="font-bold min-w-[90px]">Nombre(s):</span><span className="border-b border-black flex-1 font-black">{titularNombre}</span></div>
        <div className="flex gap-2 items-baseline"><span className="font-bold min-w-[250px]">Nombre(s) de la hija o hijo de la persona trabajadora:</span><span className="border-b border-black flex-1 font-bold">{nombreHijo}</span></div>
        <div className="flex gap-2 items-baseline"><span className="font-bold min-w-[90px]">Adscripcion:</span><span className="border-b border-black flex-1 font-bold">{valueOrEmpty(b.entidadLaboral)}</span></div>
        <div className="flex gap-2 items-baseline"><span className="font-bold min-w-[160px]">Constancia de estudios:</span><span className="border-b border-black flex-1 font-bold">{b.requiereConstanciaEstudios ? (b.constanciaEstudiosVigente ? 'VIGENTE' : '') : ''}</span></div>
        
      </div>

      <div className="border-2 border-black flex mb-3">
        <div className="w-[27%] flex flex-col border-r border-black divide-y divide-black font-bold text-[9px]">
          <div className="h-7" />
          <div className="h-8 flex items-center px-2">Receta No.</div>
          <div className="h-12 flex items-center px-2">Tipo de anteojos</div>
          <div className="h-8 flex items-center px-2">Folio</div>
          <div className="h-8 flex items-center px-2">Fecha</div>
          <div className="h-8 flex items-center px-2">Qna/Mes inclusion</div>
          <div className="h-14 flex items-start px-2 py-1 text-[8px] leading-tight">Firma de la persona trabajadora, jubilada o pensionada</div>
        </div>
        <div className="flex-1 grid grid-cols-2">
          <DotacionColumn num={1} label="Primera dotacion" />
          <DotacionColumn num={2} label="Segunda dotacion" />
        </div>
      </div>

      <div className="border-2 border-black flex">
        <div className="w-[27%] flex flex-col border-r border-black divide-y divide-black font-bold text-[9px]">
          <div className="h-7" />
          <div className="h-8 flex items-center px-2">Receta No.</div>
          <div className="h-12 flex items-center px-2">Tipo de anteojos</div>
          <div className="h-8 flex items-center px-2">Folio</div>
          <div className="h-8 flex items-center px-2">Fecha</div>
          <div className="h-8 flex items-center px-2">Qna/Mes inclusion</div>
          <div className="h-14 flex items-start px-2 py-1 text-[8px] leading-tight">Firma de la persona trabajadora, jubilada o pensionada</div>
        </div>
        <div className="flex-1 grid grid-cols-2">
          <DotacionColumn num={3} label="Tercera dotacion" />
          <DotacionColumn num={4} label="Cuarta dotacion" />
        </div>
      </div>

      <div className="mt-2 flex justify-between items-center text-[10px]">
        <span className="font-bold">Clave: 1A14-009-028</span>
      </div>
    </div>
  );
};