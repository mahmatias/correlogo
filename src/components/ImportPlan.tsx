import { useRef, useState, ChangeEvent } from 'react';
import { Download } from 'lucide-react';
import { WorkoutPlan, WorkoutStep } from '../types';

interface Props {
  onImport: (plans: WorkoutPlan[]) => void;
  plans: WorkoutPlan[];
}

// Mapa de normalização: o código sempre trabalha com os tipos em inglês
// ('warmup' | 'run' | 'rest' | 'cooldown'), mas os planos de treino são
// frequentemente escritos/exportados em português. Normalizamos aqui, na
// importação, para que o resto do app (lógica de progressão, marquee,
// modo distância) nunca precise se preocupar com o idioma do plano original.
const STEP_TYPE_MAP: Record<string, WorkoutStep['type']> = {
  'aquecimento': 'warmup',
  'corrida': 'run',
  'tiro': 'run',
  'intervalo': 'rest',
  'descanso': 'rest',
  'recuperacao': 'rest',
  'desaquecimento': 'cooldown',
  'resfriamento': 'cooldown',
  // Já em inglês: mantém como está (idempotente)
  'warmup': 'warmup',
  'run': 'run',
  'rest': 'rest',
  'cooldown': 'cooldown',
};

const normalizeStepType = (rawType: string): WorkoutStep['type'] | null => {
  const key = rawType
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos (ex: "Regeneração" -> "Regeneracao")
    .trim()
    .toLowerCase();
  return STEP_TYPE_MAP[key] ?? null;
};

export default function ImportPlan({ onImport, plans }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Processo de importação iniciado.");
    console.log(`Arquivo selecionado: ${file.name} (${file.size} bytes)`);

    const reader = new FileReader();
    reader.onload = (event) => {
      console.log("Leitura do arquivo concluída.");
      try {
        const text = event.target?.result as string;
        console.log("Tentando converter conteúdo para JSON...");
        const data = JSON.parse(text);
        console.log("JSON convertido com sucesso:", data);

        console.log("Validando estrutura do JSON...");
        const plans: WorkoutPlan[] = Array.isArray(data) ? data : [data];
        
        const validatedPlans = plans.map(p => ({
            ...p,
            id: p.id || Math.random().toString(36).substring(2, 9),
        }));

        for (const plan of validatedPlans) {
            if (!Array.isArray(plan.steps)) {
                console.error("Erro de validação: 'steps' não é uma lista.", plan);
                setImportError("Formato de plano inválido: 'steps' deve ser uma lista.");
                return;
            }
        }

        // Normaliza o campo "type" de cada etapa (ex: "Corrida" -> "run").
        // Tipos não reconhecidos são avisados no console e mantidos como
        // vieram, para não quebrar a importação por um único valor estranho.
        const unrecognizedTypes = new Set<string>();
        const normalizedPlans = validatedPlans.map(plan => ({
            ...plan,
            steps: plan.steps.map(step => {
                const normalized = normalizeStepType(String(step.type));
                if (!normalized) {
                    unrecognizedTypes.add(String(step.type));
                    return step;
                }
                return { ...step, type: normalized };
            }),
        }));

        if (unrecognizedTypes.size > 0) {
            console.error("Tipos de etapa não reconhecidos (mantidos como vieram):", Array.from(unrecognizedTypes));
            setImportError(`Atenção: alguns tipos de etapa não foram reconhecidos e podem não funcionar corretamente: ${Array.from(unrecognizedTypes).join(', ')}`);
        }

        console.log("Validação aprovada. Importando planos:", normalizedPlans.length);
        onImport(normalizedPlans);
        setImportError('');
        console.log("Planos importados com sucesso!");
      } catch (error) {
        console.error("Erro fatal na leitura do JSON:", error);
        setImportError("Erro ao ler o arquivo. Verifique o console para detalhes.");
      }
    };
    
    reader.onerror = () => {
        console.error("Erro ao ler o arquivo via FileReader.");
    };
    
    reader.readAsText(file);
  };

  return (
    <>
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
      <button 
        className="flex items-center justify-center gap-2 w-full bg-bg-elevated py-3 rounded-lg hover:opacity-80 transition text-text-primary"
        onClick={() => fileInputRef.current?.click()}
      >
        <Download size={20} />
        {plans.length > 0 ? "Substituir Plano de Treino" : "Importar Plano de Treino"}
      </button>
      {importError && <p className="text-danger text-sm mt-2" role="alert">{importError}</p>}
      {plans.length > 0 && (
          <p className="text-center text-sm text-text-secondary my-4 font-semibold">
            Programa Atual: {plans[0].programName || "Desconhecido"}
          </p>
      )}
    </>
  );
}
