
import React from 'react';
import { Tramite, TipoBeneficiario } from '../types';

interface PDFTarjetaControlViewProps {
  beneficiario: any;
  dotaciones: Tramite[];
}

export const PDFTarjetaControlView: React.FC<PDFTarjetaControlViewProps> = ({ beneficiario: b, dotaciones }) => {
  const getDotacionData = (num: number) => {
    return dotaciones.find(d => d.dotacionNumero === num);
  };

  const checkbox = (checked: boolean) => (
    <div className={`w-10 h-10 border-2 border-black flex items-center justify-center font-black text-xl bg-white`}>
      {checked ? 'X' : ''}
    </div>
  );

  const DotacionColumn = ({ num, label }: { num: number, label: string }) => {
    const data = getDotacionData(num);
    return (
      <div className="flex flex-col border-r-2 border-black last:border-r-0">
        <div className="bg-white p-1 text-center font-bold border-b-2 border-black text-sm uppercase">{label}</div>
        <div className="flex-1 flex flex-col divide-y-2 divide-black">
          <div className="h-10 flex items-center justify-center font-bold">{data?.folioRecetaImss || ''}</div>
          <div className="h-16 flex items-center justify-center px-1 text-center text-[10px] font-bold leading-tight uppercase">
            {data?.descripcionLente || ''}
          </div>
          <div className="h-10 flex items-center justify-center font-bold">{data?.folio || ''}</div>
          <div className="h-10 flex items-center justify-center font-bold">
            {data?.fechaCreacion ? new Date(data.fechaCreacion).toLocaleDateString() : ''}
          </div>
          <div className="h-10 flex items-center justify-center font-bold">{data?.qnaInclusion || ''}</div>
          <div className="h-20 flex flex-col items-center justify-end pb-1 overflow-hidden">
             <span className="text-[9px] text-center font-bold uppercase truncate w-full px-1">{data?.beneficiario.nombre ? `${data.beneficiario.nombre} ${data.beneficiario.apellidoPaterno}` : ''}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-10 w-[215.9mm] min-h-[279.4mm] mx-auto text-[11px] font-sans uppercase print-container text-black border border-gray-100 shadow-xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4 items-center">
          <div className="w-16 h-16">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/74/IMSS_Logo.svg" alt="IMSS" className="w-full" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold">TARJETA DE CONTROL DE DOTACIÓN DE ANTEOJOS</h1>
            <div className="flex gap-2 items-baseline">
              <span className="font-bold">OOAD:</span>
              <span className="border-b-2 border-black min-w-[200px] font-bold text-sm">{b.ooad || '03 - BAJA CALIFORNIA SUR'}</span>
            </div>
            <p className="font-bold mt-1">Jefatura de Servicios de Desarrollo de Personal</p>
          </div>
        </div>
        <div className="flex gap-2 items-baseline">
          <span className="font-bold">MATRÍCULA:</span>
          <span className="border-b-2 border-black min-w-[150px] text-center font-black text-lg">{b.matricula}</span>
        </div>
      </div>

      <div className="mt-6 mb-6">
        <p className="font-bold mb-4">SE AUTORIZA LA DOTACIÓN DE ANTEOJOS A LA PERSONA:</p>
        <div className="flex justify-between px-4">
          <div className="flex items-center gap-4">
            {checkbox(b.tipo === TipoBeneficiario.TRABAJADOR)}
            <span className="font-bold">TRABAJADORA</span>
          </div>
          <div className="flex items-center gap-4">
            {checkbox(b.tipo === TipoBeneficiario.JUBILADO_PENSIONADO)}
            <span className="font-bold">JUBILADA</span>
          </div>
          <div className="flex items-center gap-4">
            {checkbox(b.tipo === TipoBeneficiario.PENSIONADA)}
            <span className="font-bold">PENSIONADA</span>
          </div>
          <div className="flex items-center gap-4">
            {checkbox(b.tipo === TipoBeneficiario.HIJO)}
            <span className="font-bold">BENEFICIARIO (A)</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex gap-2 items-baseline">
          <span className="font-bold min-w-[150px]">NOMBRE (S):</span>
          <span className="border-b-2 border-black flex-1 font-black text-lg">{`${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombre}`}</span>
        </div>
        <div className="flex gap-2 items-baseline">
          <span className="font-bold min-w-[280px]">NOMBRE (S) DE LA HIJA O HIJO DE LA PERSONA TRABAJADORA:</span>
          <span className="border-b-2 border-black flex-1 font-bold">{b.tipo === TipoBeneficiario.HIJO ? b.nombre : 'N/A'}</span>
        </div>
        <div className="flex gap-2 items-baseline">
          <span className="font-bold min-w-[150px]">ADSCRIPCIÓN:</span>
          <span className="border-b-2 border-black flex-1 font-bold text-lg">{b.entidadLaboral}</span>
        </div>
      </div>

      {/* Grid Top Part */}
      <div className="border-2 border-black flex">
        <div className="w-1/4 flex flex-col border-r-2 border-black divide-y-2 divide-black font-bold">
           <div className="h-8 bg-white"></div>
           <div className="h-10 flex items-center px-2">RECETA N°</div>
           <div className="h-16 flex items-center px-2">TIPO DE ANTEOJOS</div>
           <div className="h-10 flex items-center px-2">FOLIO</div>
           <div className="h-10 flex items-center px-2">FECHA</div>
           <div className="h-10 flex items-center px-2">QNA/MES DE INCLUSIÓN</div>
           <div className="h-20 flex items-start px-2 py-1 text-[9px] leading-tight">
             FIRMA DE LA PERSONA TRABAJADORA JUBILADA O PENSIONADA
           </div>
        </div>
        <div className="flex-1 grid grid-cols-2">
          <DotacionColumn num={1} label="PRIMERA DOTACIÓN" />
          <DotacionColumn num={2} label="SEGUNDA DOTACIÓN" />
        </div>
      </div>

      {/* Grid Bottom Part */}
      <div className="border-2 border-black mt-6 flex">
        <div className="w-1/4 flex flex-col border-r-2 border-black divide-y-2 divide-black font-bold">
           <div className="h-8 bg-white"></div>
           <div className="h-10 flex items-center px-2">RECETA N°</div>
           <div className="h-16 flex items-center px-2">TIPO DE ANTEOJOS</div>
           <div className="h-10 flex items-center px-2">FOLIO</div>
           <div className="h-10 flex items-center px-2">FECHA</div>
           <div className="h-10 flex items-center px-2">QNA/MES DE INCLUSIÓN</div>
           <div className="h-20 flex items-start px-2 py-1 text-[9px] leading-tight">
             FIRMA DE LA PERSONA TRABAJADORA JUBILADA O PENSIONADA
           </div>
        </div>
        <div className="flex-1 grid grid-cols-2">
          <DotacionColumn num={3} label="TERCERA DOTACIÓN" />
          <DotacionColumn num={4} label="CUARTA DOTACIÓN" />
        </div>
      </div>

      <div className="mt-12 flex justify-end">
        <span className="font-bold text-sm">Clave: 1A14-009-028</span>
      </div>
    </div>
  );
};
