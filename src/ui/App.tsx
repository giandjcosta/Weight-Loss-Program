import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  addDays,
  deviceTimeZone,
  nowIso,
  parseDayKey,
  parseDecimal,
  type DayKey,
  type GoalDirection,
  type Id,
  type MealSlot,
  type Repository,
  type WeightEntry,
  type MealEntry,
  type WorkoutSession,
  type Result,
  type Message,
} from '../core';
import { DEMO_DAYS, DEMO_START_DAY } from '../data/fixtures/demo';
import {
  deriveDay,
  readSnapshot,
  formatDay,
  formatValue,
  statusDescription,
  DIRECTION_LABEL,
  WORKOUT_STATUS_LABEL,
  workoutEditPatch,
  type UiSnapshot,
} from './model';
import logoDark from './assets/ritmea-logo-dark.svg';
import logoLight from './assets/ritmea-logo-light.svg';
import './styles.css';

type Page = 'home' | 'diary' | 'training' | 'progress' | 'settings';
type Kind = 'weight' | 'meal' | 'workout' | 'goal';
type Dialog = { kind: Kind; id?: Id };
const nav: { id: Page; label: string; short: string; icon: string }[] = [
  { id: 'home', label: 'Panoramica', short: 'Home', icon: '⌂' },
  { id: 'diary', label: 'Diario', short: 'Diario', icon: '▤' },
  { id: 'training', label: 'Allenamenti', short: 'Palestra', icon: '◇' },
  { id: 'progress', label: 'Progressi', short: 'Progressi', icon: '↗' },
  { id: 'settings', label: 'Impostazioni', short: 'Altro', icon: '⚙' },
];
const slots: Record<MealSlot, string> = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Spuntino',
};
const unknown = 'Non registrato';
const source = { kind: 'manual' as const };
function numeric(value: FormDataEntryValue | null, required = false): number | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) throw Error('Compila il campo obbligatorio.');
    return undefined;
  }
  const parsed = parseDecimal(raw, 'it');
  if (!parsed.ok) throw Error('Numero non valido: usa, ad esempio, 75,2.');
  return parsed.value;
}
export function messageInItalian(error: Message): string {
  switch (error.code) {
    case 'validation.out_of_range':
      return `Valore per ${error.args.field} fuori dall'intervallo consentito (${error.args.min}–${error.args.max} ${error.args.unit}).`;
    case 'validation.required':
      return `Compila il campo obbligatorio: ${error.args.field}.`;
    case 'validation.not_a_number':
      return 'Inserisci un numero valido.';
    case 'validation.invalid_date':
    case 'validation.future_date':
      return 'Controlla la data inserita.';
    case 'validation.inconsistent':
      return 'Alcuni valori non sono coerenti: ' + error.args.fields.join(', ') + '.';
    case 'validation.invalid_color':
      return 'Inserisci un colore valido nel formato #RRGGBB.';
    case 'repo.not_found':
      return 'Registrazione non trovata. Aggiorna la pagina e riprova.';
    case 'repo.append_only':
      return 'Per cambiare un obiettivo, aggiungine uno nuovo senza modificare lo storico.';
    case 'repo.storage_unavailable':
      return 'Archivio non disponibile. Riprova o verifica lo spazio sul dispositivo.';
    case 'repo.quota_exceeded':
      return 'Spazio di archiviazione esaurito.';
    case 'import.unsupported_format':
      return 'Formato del file non supportato.';
    case 'import.malformed':
      return 'Il file contiene dati non validi.';
    case 'import.duplicates_skipped':
      return `${error.args.count} duplicati ignorati.`;
    case 'import.invalid_skipped':
      return `${error.args.count} righe non valide ignorate.`;
    case 'calc.not_enough_readings':
    case 'calc.span_too_short':
    case 'calc.goal_missing':
    case 'calc.inputs_missing':
    case 'calc.not_applicable_for_direction':
      return 'Dati insufficienti per questo calcolo.';
  }
}
function check<T>(result: Result<T>): T {
  if (!result.ok) throw Error(messageInItalian(result.error));
  return result.value;
}
function MetricContent({ value }: { value: string }) {
  const match = /^(.+?)\s(kg|kcal|ml)$/.exec(value);
  return match ? (
    <>
      {match[1]} <span class="unit">{match[2]}</span>
    </>
  ) : (
    <>{value}</>
  );
}
function Card({ children, className = '' }: { children: ComponentChildren; className?: string }) {
  return <section class={'card ' + className}>{children}</section>;
}
function Header({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ComponentChildren;
}) {
  return (
    <div class="card-head">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
function NoData({ label = 'Non ci sono registrazioni per questo giorno.' }: { label?: string }) {
  return (
    <div class="no-data">
      <span aria-hidden="true">◌</span>
      <p>{label}</p>
    </div>
  );
}
function WeightGraph({ weights, day }: { weights: WeightEntry[]; day: DayKey }) {
  const items = weights.filter((w) => w.dayKey <= day).slice(-30);
  if (!items.length) return <NoData label="Le pesate aggiunte appariranno qui." />;
  const lo = Math.min(...items.map((w) => w.kg)) - 1,
    hi = Math.max(...items.map((w) => w.kg)) + 1;
  const points = items.map((w, i) => [
    35 + (items.length === 1 ? 270 : (i * 520) / (items.length - 1)),
    174 - ((w.kg - lo) * 126) / Math.max(1, hi - lo),
  ]);
  return (
    <svg
      class="graph"
      viewBox="0 0 600 210"
      role="img"
      aria-label={
        'Grafico con ' +
        items.length +
        ' pesate; ultimo peso ' +
        formatValue(items.at(-1)?.kg) +
        ' kg'
      }
    >
      {[50, 95, 140, 184].map((y) => (
        <line key={y} x1="30" x2="580" y1={y} y2={y} stroke="currentColor" opacity=".22" />
      ))}
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#93c8a2"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 5 : 3} fill="#c5e8ca" />
      ))}
      <text x="35" y="203" fill="currentColor" font-size="12">
        {items[0]?.dayKey.slice(5)}
      </text>
      <text x="565" y="203" fill="currentColor" font-size="12" text-anchor="end">
        {items.at(-1)?.dayKey.slice(5)}
      </text>
    </svg>
  );
}
function Row({
  title,
  caption,
  amount,
  edit,
  remove,
}: {
  title: string;
  caption: string;
  amount?: string | undefined;
  edit?: () => void;
  remove?: () => void;
}) {
  return (
    <div class="entry">
      <div class="entry-body">
        <strong>{title}</strong>
        <small>{caption}</small>
      </div>
      {amount && (
        <b>
          <MetricContent value={amount} />
        </b>
      )}
      <div class="row-tools">
        {edit && (
          <button type="button" aria-label={'Modifica ' + title} onClick={edit}>
            ✎
          </button>
        )}
        {remove && (
          <button type="button" aria-label={'Elimina ' + title} onClick={remove}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
function Field({
  label,
  name,
  value = '',
  type = 'text',
  required = false,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label class="form-field">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={value}
        required={required}
        inputMode={
          [
            'kg',
            'kcal',
            'protein',
            'carbs',
            'fat',
            'duration',
            'treadmill',
            'startKg',
            'targetKg',
            'band',
            'height',
          ].includes(name)
            ? 'decimal'
            : undefined
        }
      />
    </label>
  );
}
function DialogForm({
  dialog,
  data,
  day,
  close,
  save,
  error,
}: {
  dialog: Dialog;
  data: UiSnapshot;
  day: DayKey;
  close: () => void;
  save: (fd: FormData) => Promise<void>;
  error: string;
}) {
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    modalRef.current?.querySelector<HTMLInputElement>('input[name="day"]')?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);
  const trapTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables?.length) return;
    const first = focusables.item(0);
    const last = focusables.item(focusables.length - 1);
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !modalRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !modalRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };
  const old = dialog.id
    ? dialog.kind === 'weight'
      ? data.weights.find((x) => x.id === dialog.id)
      : dialog.kind === 'meal'
        ? data.meals.find((x) => x.id === dialog.id)
        : data.workouts.find((x) => x.id === dialog.id)
    : undefined;
  const weight = dialog.kind === 'weight' ? (old as WeightEntry | undefined) : undefined;
  const meal = dialog.kind === 'meal' ? (old as MealEntry | undefined) : undefined;
  const workout = dialog.kind === 'workout' ? (old as WorkoutSession | undefined) : undefined;
  const date = old && 'dayKey' in old ? old.dayKey : day;
  const title = {
    weight: 'Registra peso',
    meal: 'Aggiungi pasto',
    workout: 'Allenamento',
    goal: 'Nuovo obiettivo',
  }[dialog.kind];
  return (
    <div class="overlay" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        class="dialog"
        ref={modalRef}
        onKeyDown={trapTab}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span class="eyebrow">SESSIONE DEMO</span>
            <h2>{title}</h2>
          </div>
          <button type="button" class="icon-button" onClick={close} aria-label="Chiudi">
            ×
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(new FormData(e.currentTarget));
          }}
        >
          {error && (
            <div class="dialog-error" role="alert">
              {error}
            </div>
          )}
          <Field label="Data" name="day" type="date" required value={date} />
          {dialog.kind === 'weight' && (
            <>
              <Field label="Peso in kg" name="kg" required value={weight?.kg ?? ''} />
              <Field label="Nota (facoltativa)" name="note" value={weight?.note ?? ''} />
            </>
          )}
          {dialog.kind === 'meal' && (
            <>
              <label class="form-field">
                Pasto
                <select name="slot" defaultValue={meal?.slot ?? 'lunch'}>
                  {(Object.keys(slots) as MealSlot[]).map((s) => (
                    <option value={s} key={s}>
                      {slots[s]}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Cosa hai mangiato?" name="name" required value={meal?.name ?? ''} />
              <Field label="kcal registrate (facoltative)" name="kcal" value={meal?.kcal ?? ''} />
              <Field label="Proteine g (facoltative)" name="protein" value={meal?.proteinG ?? ''} />
              <Field label="Carboidrati g (facoltativi)" name="carbs" value={meal?.carbsG ?? ''} />
              <Field label="Grassi g (facoltativi)" name="fat" value={meal?.fatG ?? ''} />
              <p class="fineprint">
                Valori vuoti = sconosciuti. Non stimiamo automaticamente i nutrienti.
              </p>
            </>
          )}
          {dialog.kind === 'workout' && (
            <>
              <Field
                label="Nome allenamento"
                name="title"
                required
                value={workout?.title ?? 'Allenamento demo'}
              />
              <label class="form-field">
                Stato
                <select name="status" defaultValue={workout?.status ?? 'completed'}>
                  <option value="completed">Completato</option>
                  <option value="skipped">Saltato</option>
                  <option value="rescheduled">Riprogrammato</option>
                </select>
              </label>
              <Field
                label="Durata in minuti (facoltativa)"
                name="duration"
                value={workout?.durationMin ?? ''}
              />
              <Field
                label="Riprogrammato al (se necessario)"
                name="rescheduled"
                type="date"
                value={workout?.rescheduledTo ?? ''}
              />
              <Field
                label="Tapis roulant in minuti (facoltativo)"
                name="treadmill"
                value={workout?.cardio.find((x) => x.kind === 'treadmill')?.minutes ?? ''}
              />
            </>
          )}
          {dialog.kind === 'goal' && (
            <>
              <label class="form-field">
                Tipo di obiettivo
                <select name="direction" defaultValue="lose">
                  <option value="lose">Dimagrimento</option>
                  <option value="gain">Aumento</option>
                  <option value="maintain">Mantenimento</option>
                  <option value="recomp">Ricomposizione</option>
                </select>
              </label>
              <Field label="Peso iniziale kg (facoltativo)" name="startKg" />
              <Field label="Peso obiettivo kg (facoltativo)" name="targetKg" />
              <Field label="Fascia ± kg, per mantenimento" name="band" />
              <p class="fineprint">
                La modifica crea una nuova voce nello storico, senza riscrivere il passato.
              </p>
            </>
          )}
          <div class="dialog-actions">
            <button type="button" class="btn soft" onClick={close}>
              Annulla
            </button>
            <button class="btn primary" type="submit">
              Salva demo
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function App({ repository, onReset }: { repository: Repository; onReset: () => void }) {
  const [page, setPage] = useState<Page>('home');
  const [day, setDay] = useState<DayKey>(() => addDays(DEMO_START_DAY, DEMO_DAYS - 1));
  const [data, setData] = useState<UiSnapshot | undefined>();
  const [dialog, setDialog] = useState<Dialog | undefined>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void readSnapshot(repository)
        .then((s) => {
          if (active) setData(s);
        })
        .catch(() => {
          if (active) setMessage('Errore nella lettura della demo.');
        });
    };
    refresh();
    const unsubscribe = repository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialog(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const view = data ? deriveDay(data, day) : undefined;
  async function execute(fn: () => Promise<void>, success = 'Demo aggiornata.') {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
      setDialog(undefined);
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }
  function open(kind: Kind, id?: Id) {
    setMessage('');
    setDialog(id ? { kind, id } : { kind });
  }
  async function water(ml: number) {
    await execute(async () => {
      check(await repository.add('water', { dayKey: day, timeZone: deviceTimeZone(), ml, source }));
    }, 'Acqua aggiunta alla demo.');
  }
  async function remove(collection: 'weights' | 'meals' | 'water' | 'workouts', id: Id) {
    if (!window.confirm('Eliminare la registrazione dimostrativa?')) return;
    await execute(async () => {
      check(await repository.remove(collection, id));
    }, 'Registrazione eliminata.');
  }
  async function nutritionStatus(value: 'unknown' | 'unlogged' | 'partial' | 'complete') {
    await execute(async () => {
      if (view?.status)
        check(await repository.update('dayStatus', view.status.id, { nutrition: value }));
      else
        check(
          await repository.add('dayStatus', {
            dayKey: day,
            nutrition: value,
            water: 'unknown',
            source,
          }),
        );
    });
  }
  async function save(fd: FormData) {
    if (!dialog) return;
    await execute(async () => {
      const date = parseDayKey(String(fd.get('day') ?? ''));
      if (!date) throw Error('Data non valida.');
      if (dialog.kind === 'weight') {
        const kg = numeric(fd.get('kg'), true);
        if (kg === undefined) throw Error('Inserisci un peso valido.');
        const noteText = String(fd.get('note') ?? '').trim();
        const note = noteText === '' ? undefined : noteText; // empty note = no note, not ''
        if (dialog.id)
          check(await repository.update('weights', dialog.id, { dayKey: date, kg, note } as never));
        else
          check(
            await repository.add('weights', {
              dayKey: date,
              timeZone: deviceTimeZone(),
              kg,
              quality: 'measured',
              ...(note === undefined ? {} : { note }),
              source,
            }),
          );
      } else if (dialog.kind === 'meal') {
        const name = String(fd.get('name') ?? '').trim();
        if (!name) throw Error('Inserisci il nome del pasto.');
        const kcal = numeric(fd.get('kcal')),
          proteinG = numeric(fd.get('protein')),
          carbsG = numeric(fd.get('carbs')),
          fatG = numeric(fd.get('fat'));
        const slot = String(fd.get('slot')) as MealSlot;
        const fields = {
          dayKey: date,
          name,
          slot,
          ...(kcal === undefined ? {} : { kcal }),
          ...(proteinG === undefined ? {} : { proteinG }),
          ...(carbsG === undefined ? {} : { carbsG }),
          ...(fatG === undefined ? {} : { fatG }),
        };
        if (dialog.id) {
          const patch: Record<string, unknown> = { ...fields };
          // Clear previously present optional nutrients when their field is emptied.
          const optionalNutrientFields = [
            ['kcal', 'kcal'],
            ['protein', 'proteinG'],
            ['carbs', 'carbsG'],
            ['fat', 'fatG'],
          ] as const;
          for (const [input, key] of optionalNutrientFields) {
            if (String(fd.get(input) ?? '').trim() === '') patch[key] = undefined;
          }
          check(await repository.update('meals', dialog.id, patch as never));
        } else
          check(
            await repository.add('meals', {
              ...fields,
              timeZone: deviceTimeZone(),
              quality: 'estimated',
              source,
            }),
          );
      } else if (dialog.kind === 'workout') {
        const title = String(fd.get('title') ?? '').trim();
        if (!title) throw Error('Inserisci il nome dell’allenamento.');
        const status = String(fd.get('status')) as WorkoutSession['status'];
        const durationMin = numeric(fd.get('duration'));
        const treadmill = numeric(fd.get('treadmill'));
        const newDate = String(fd.get('rescheduled') ?? '');
        const rescheduledTo = newDate ? parseDayKey(newDate) : undefined;
        if (status === 'rescheduled' && !rescheduledTo) throw Error('Scegli la nuova data.');
        const cardio =
          treadmill === undefined ? [] : [{ kind: 'treadmill' as const, minutes: treadmill }];
        const fields = {
          dayKey: date,
          title,
          status,
          cardio,
          exercises: [],
          ...(durationMin === undefined ? {} : { durationMin }),
          ...(status === 'rescheduled' && rescheduledTo ? { rescheduledTo } : {}),
        };
        if (dialog.id) {
          const current = await repository.get('workouts', dialog.id);
          if (!current) throw Error('Allenamento non trovato.');
          // keep stored exercises/sets and treadmill distance/incline (not in this form)
          const patch = workoutEditPatch(current, {
            dayKey: date,
            title,
            status,
            durationMin,
            rescheduledTo,
            treadmillMinutes: treadmill,
          });
          check(await repository.update('workouts', dialog.id, patch as never));
        } else
          check(
            await repository.add('workouts', { ...fields, timeZone: deviceTimeZone(), source }),
          );
      } else {
        const direction = String(fd.get('direction')) as GoalDirection;
        const startKg = numeric(fd.get('startKg')),
          targetKg = numeric(fd.get('targetKg'));
        const band = numeric(fd.get('band'));
        check(
          await repository.add('goals', {
            effectiveFrom: date,
            direction,
            setBy: 'user',
            source,
            ...(startKg === undefined ? {} : { startKg }),
            ...(targetKg === undefined ? {} : { targetKg }),
            ...(direction === 'maintain' && band !== undefined ? { maintainBandKg: band } : {}),
          }),
        );
      }
    });
  }
  async function preferences(fd: FormData) {
    await execute(async () => {
      const height = numeric(fd.get('height'));
      const displayName = String(fd.get('name') ?? '').trim();
      const heightAnswer = String(fd.get('heightAnswer') ?? 'unchanged');
      check(
        await repository.saveProfile({
          displayName,
          ...(height !== undefined
            ? { heightCm: { kind: 'value' as const, value: height } }
            : heightAnswer === 'unknown'
              ? { heightCm: { kind: 'unknown' as const } }
              : {}),
        }),
      );
      const theme = String(fd.get('theme')) as 'dark' | 'light' | 'system';
      const appIcon = String(fd.get('icon')) as 'primary' | 'bars';
      check(await repository.saveSettings({ theme, appIcon, onboardingCompletedAt: nowIso() }));
    }, 'Preferenze demo salvate.');
  }
  function reset() {
    if (window.confirm('Ripristinare la demo? Le modifiche della sessione andranno perse.')) {
      onReset();
      setPage('home');
    }
  }
  const theme = data?.settings.theme ?? 'dark';
  const action = (kind: Kind, label: string) => (
    <button class="btn soft" onClick={() => open(kind)}>
      ＋ {label}
    </button>
  );
  const listEmpty = (
    <NoData label="Nessun dato inserito. Un giorno non registrato non equivale a zero." />
  );
  return (
    <div class={'ritmea ' + (theme === 'light' ? 'light' : theme === 'system' ? 'system' : 'dark')}>
      <div class="layout">
        <aside class="sidebar">
          <img class="logo" src={theme === 'light' ? logoLight : logoDark} alt="Ritmea" />
          <span class="eyebrow">LA TUA AREA</span>
          <nav class="nav" aria-label="Navigazione principale">
            {nav.map((item) => (
              <button
                data-page={item.id}
                key={item.id}
                onClick={() => setPage(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
                class={page === item.id ? 'active' : ''}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div class="sidebar-note">
            <strong>ALPHA 0.1 · DEMO</strong>
            <p>Solo dati sintetici. Nessun salvataggio permanente o sincronizzazione.</p>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <img class="mobile-logo" src={theme === 'light' ? logoLight : logoDark} alt="Ritmea" />
            <div class="desktop-head">
              <span class="eyebrow">RITMEA · ALPHA 0.1</span>
              <strong>{nav.find((n) => n.id === page)?.label}</strong>
            </div>
            <label class="date-picker">
              Giorno demo
              <input
                type="date"
                aria-label="Seleziona il giorno"
                value={day}
                onChange={(e) => {
                  const v = parseDayKey(e.currentTarget.value);
                  if (v) setDay(v);
                }}
              />
            </label>
          </header>
          <main class="content">
            <div class="demo-note" role="note">
              <span aria-hidden="true">ⓘ</span>
              <p>
                <b>Demo interattiva con dati fittizi.</b> Non inserire informazioni sanitarie
                personali. Ricaricando la pagina, le modifiche andranno perse.
              </p>
            </div>
            {message && (
              <div class="alert" role="status">
                {message}
                <button aria-label="Chiudi messaggio" onClick={() => setMessage('')}>
                  ×
                </button>
              </div>
            )}
            {!data || !view ? (
              <p>Caricamento demo…</p>
            ) : (
              <>
                {page === 'home' && (
                  <div class="stack">
                    <div class="hero">
                      <div>
                        <span class="eyebrow">IL TUO RITMO, I TUOI PROGRESSI</span>
                        <h1>
                          Un passo alla volta<span class="sage">.</span>
                        </h1>
                        <p>Una vista chiara del percorso, senza numeri inventati.</p>
                      </div>
                      <button class="btn primary" onClick={() => open('weight')}>
                        ＋ Registra peso
                      </button>
                    </div>
                    <div class="metrics">
                      {[
                        [
                          'ULTIMA PESATA',
                          formatValue(view.lastWeight?.kg) + ' kg',
                          view.lastWeight ? formatDay(view.lastWeight.dayKey) : unknown,
                        ],
                        [
                          'OBIETTIVO',
                          formatValue(view.goal?.targetKg) + ' kg',
                          (view.goal ? DIRECTION_LABEL[view.goal.direction] : undefined) ?? unknown,
                        ],
                        [
                          'CALORIE REGISTRATE',
                          view.mealKcal === undefined
                            ? '—'
                            : formatValue(view.mealKcal, 0) + ' kcal',
                          statusDescription(view.status, 'nutrition'),
                        ],
                        [
                          'ACQUA REGISTRATA',
                          view.waterMl === undefined ? '—' : formatValue(view.waterMl, 0) + ' ml',
                          statusDescription(view.status, 'water'),
                        ],
                      ].map((item) => (
                        <Card key={item[0]} className="metric">
                          <small>{item[0]}</small>
                          <strong>
                            <MetricContent value={item[1]} />
                          </strong>
                          <span>{item[2]}</span>
                        </Card>
                      ))}
                    </div>
                    <div class="columns">
                      <Card>
                        <Header
                          title="Andamento del peso"
                          detail="Ultime 30 pesate demo"
                          action={action('weight', 'Pesata')}
                        />
                        <WeightGraph weights={data.weights} day={day} />
                      </Card>
                      <Card>
                        <Header
                          title="Il tuo percorso"
                          detail="Avanzamento indicativo, non una previsione"
                        />
                        <div class="progress-row">
                          <span>Progresso sull'obiettivo</span>
                          <b>
                            {view.progressPercent === undefined
                              ? '—'
                              : formatValue(view.progressPercent, 0) + '%'}
                          </b>
                        </div>
                        <div
                          class="track"
                          role={view.progressPercent === undefined ? undefined : 'progressbar'}
                          aria-valuenow={
                            view.progressPercent === undefined
                              ? undefined
                              : Math.round(view.progressPercent)
                          }
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: (view.progressPercent ?? 0) + '%' }} />
                        </div>
                        <p class="fineprint">
                          {view.progressPercent === undefined
                            ? 'Aggiungi una pesata e un obiettivo per vedere l’avanzamento.'
                            : 'Dal peso iniziale al target. Non è una stima dei tempi.'}
                        </p>
                        <div class="progress-row">
                          <span>Idratazione</span>
                          <b>
                            {view.waterMl === undefined
                              ? '—'
                              : formatValue(view.waterMl, 0) + ' ml'}
                          </b>
                        </div>
                        <div class="track">
                          <span
                            style={{
                              width:
                                (view.waterMl !== undefined && view.waterTarget
                                  ? Math.min(100, (view.waterMl / view.waterTarget) * 100)
                                  : 0) + '%',
                            }}
                          />
                        </div>
                        <button class="btn soft full" onClick={() => void water(250)}>
                          ＋ 250 ml di acqua
                        </button>
                      </Card>
                    </div>
                    <Card>
                      <Header
                        title="Azioni rapide"
                        detail="Ogni interazione aggiorna il Repository in memoria"
                      />
                      <div class="quick">
                        <button onClick={() => open('meal')}>
                          ♧<small>Nuovo pasto</small>
                        </button>
                        <button onClick={() => open('workout')}>
                          ◇<small>Allenamento</small>
                        </button>
                        <button onClick={() => open('weight')}>
                          ⚖<small>Pesata</small>
                        </button>
                        <button onClick={() => setPage('diary')}>
                          ▤<small>Apri diario</small>
                        </button>
                      </div>
                    </Card>
                  </div>
                )}
                {page === 'diary' && (
                  <div class="stack">
                    <div class="page-title">
                      <span class="eyebrow">REGISTRAZIONI DEL GIORNO</span>
                      <h1>
                        Il tuo diario<span class="sage">.</span>
                      </h1>
                      <p>Calorie e acqua non registrate restano sconosciute, non zero.</p>
                    </div>
                    <div class="columns">
                      <Card>
                        <Header
                          title="Alimentazione"
                          detail={statusDescription(view.status, 'nutrition')}
                          action={action('meal', 'Pasto')}
                        />
                        {view.meals.length
                          ? view.meals.map((m) => (
                              <Row
                                key={m.id}
                                title={m.name ?? slots[m.slot]}
                                caption={
                                  slots[m.slot] +
                                  ' · ' +
                                  (m.quality === 'verified' ? 'verificato' : 'stima')
                                }
                                amount={
                                  m.kcal === undefined
                                    ? 'kcal non indicate'
                                    : formatValue(m.kcal, 0) + ' kcal'
                                }
                                edit={() => open('meal', m.id)}
                                remove={() => void remove('meals', m.id)}
                              />
                            ))
                          : listEmpty}
                        <label class="form-field">
                          Completezza alimentazione
                          <select
                            value={view.status?.nutrition ?? 'unknown'}
                            onChange={(e) =>
                              void nutritionStatus(
                                e.currentTarget.value as
                                  'unknown' | 'unlogged' | 'partial' | 'complete',
                              )
                            }
                          >
                            <option value="unknown">Non specificata</option>
                            <option value="unlogged">Non registrata</option>
                            <option value="partial">Parziale</option>
                            <option value="complete">Completa</option>
                          </select>
                        </label>
                      </Card>
                      <Card>
                        <Header
                          title="Idratazione"
                          detail={statusDescription(view.status, 'water')}
                        />
                        <div class="big-value">
                          {view.waterMl === undefined ? '—' : formatValue(view.waterMl, 0)}{' '}
                          <small>ml</small>
                        </div>
                        <div class="amounts">
                          <button onClick={() => void water(250)}>＋ 250 ml</button>
                          <button onClick={() => void water(500)}>＋ 500 ml</button>
                        </div>
                        {view.water.length
                          ? view.water.map((w) => (
                              <Row
                                key={w.id}
                                title={formatValue(w.ml, 0) + ' ml'}
                                caption={formatDay(w.dayKey)}
                                remove={() => void remove('water', w.id)}
                              />
                            ))
                          : listEmpty}
                      </Card>
                    </div>
                    <Card>
                      <Header title="Pesate" action={action('weight', 'Pesata')} />
                      {data.weights
                        .filter((w) => w.dayKey === day)
                        .map((w) => (
                          <Row
                            key={w.id}
                            title={formatValue(w.kg) + ' kg'}
                            caption={w.note ?? 'Misurazione'}
                            edit={() => open('weight', w.id)}
                            remove={() => void remove('weights', w.id)}
                          />
                        ))}
                      {!data.weights.some((w) => w.dayKey === day) && listEmpty}
                    </Card>
                  </div>
                )}
                {page === 'training' && (
                  <div class="stack">
                    <div class="page-title">
                      <span class="eyebrow">MOVIMENTO</span>
                      <h1>
                        Allenamenti<span class="sage">.</span>
                      </h1>
                      <p>Sessioni completate, saltate o riprogrammate.</p>
                    </div>
                    <Card>
                      <Header
                        title="Allenamenti del giorno"
                        action={action('workout', 'Sessione')}
                      />
                      {view.workouts.length
                        ? view.workouts.map((w) => (
                            <Row
                              key={w.id}
                              title={w.title}
                              caption={w.status + ' · ' + formatDay(w.dayKey)}
                              amount={
                                w.durationMin === undefined ? undefined : w.durationMin + ' min'
                              }
                              edit={() => open('workout', w.id)}
                              remove={() => void remove('workouts', w.id)}
                            />
                          ))
                        : listEmpty}
                    </Card>
                    <Card>
                      <Header title="Sessioni precedenti" detail="Cronologia sintetica" />
                      {[...data.workouts]
                        .filter((w) => w.dayKey < day)
                        .reverse()
                        .slice(0, 8)
                        .map((w) => (
                          <Row
                            key={w.id}
                            title={w.title}
                            caption={formatDay(w.dayKey) + ' · ' + WORKOUT_STATUS_LABEL[w.status]}
                            amount={
                              w.durationMin === undefined ? undefined : w.durationMin + ' min'
                            }
                            edit={() => open('workout', w.id)}
                            remove={() => void remove('workouts', w.id)}
                          />
                        ))}
                    </Card>
                  </div>
                )}
                {page === 'progress' && (
                  <div class="stack">
                    <div class="page-title">
                      <span class="eyebrow">IL TEMPO FA LA DIFFERENZA</span>
                      <h1>
                        Progressi<span class="sage">.</span>
                      </h1>
                      <p>
                        Lo storico è disponibile. Le stime temporali arriveranno dopo la revisione
                        del motore di calcolo.
                      </p>
                    </div>
                    <Card>
                      <Header title="Storico delle pesate" action={action('weight', 'Pesata')} />
                      <WeightGraph weights={data.weights} day={day} />
                    </Card>
                    <div class="columns">
                      <Card>
                        <Header title="Obiettivo attivo" action={action('goal', 'Nuovo')} />
                        <div class="big-value">
                          {formatValue(view.goal?.targetKg)} <small>kg</small>
                        </div>
                        <p class="fineprint">
                          {view.goal
                            ? 'In vigore dal ' + formatDay(view.goal.effectiveFrom)
                            : 'Nessun obiettivo impostato.'}
                        </p>
                      </Card>
                      <Card>
                        <Header title="Stime e scenari" />
                        <div class="quiet">
                          <b>Previsione non disponibile</b>
                          <p>
                            Il calcolo sarà collegato solo quando il modulo di Claude sarà pronto.
                            Nessuna data inventata.
                          </p>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
                {page === 'settings' && (
                  <div class="stack">
                    <div class="page-title">
                      <span class="eyebrow">LE TUE PREFERENZE</span>
                      <h1>
                        Impostazioni<span class="sage">.</span>
                      </h1>
                      <p>Le modifiche sono soltanto temporanee in questa alpha.</p>
                    </div>
                    <div class="columns">
                      <Card>
                        <Header
                          title="Profilo demo"
                          detail="Le informazioni sconosciute non vengono inventate"
                        />
                        <form
                          class="stack form-stack"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void preferences(new FormData(e.currentTarget));
                          }}
                        >
                          <Field
                            label="Nome visualizzato"
                            name="name"
                            value={data.profile.displayName ?? ''}
                          />
                          <Field
                            label="Altezza cm — facoltativa"
                            name="height"
                            value={
                              data.profile.heightCm?.kind === 'value'
                                ? data.profile.heightCm.value
                                : ''
                            }
                          />
                          <label class="form-field">
                            Se non conosci la tua altezza
                            <select
                              name="heightAnswer"
                              defaultValue={
                                data.profile.heightCm?.kind === 'unknown' ? 'unknown' : 'unchanged'
                              }
                            >
                              <option value="unchanged">
                                Lascia non specificato / non modificare
                              </option>
                              <option value="unknown">Non lo so</option>
                            </select>
                          </label>
                          <label class="form-field">
                            Tema
                            <select name="theme" defaultValue={data.settings.theme}>
                              <option value="dark">Scuro</option>
                              <option value="light">Chiaro</option>
                              <option value="system">Sistema</option>
                            </select>
                          </label>
                          <label class="form-field">
                            Icona preferita
                            <select name="icon" defaultValue={data.settings.appIcon}>
                              <option value="primary">A+B (principale)</option>
                              <option value="bars">Solo barre (alternativa)</option>
                            </select>
                          </label>
                          <button class="btn primary" type="submit">
                            Salva nella demo
                          </button>
                        </form>
                      </Card>
                      <Card>
                        <Header title="Privacy e ripristino" />
                        <div class="quiet">
                          <b>Modalità demo in memoria</b>
                          <p>
                            Non inserire dati reali. La demo non sincronizza, non conserva
                            informazioni dopo il ricaricamento e non attiva HealthKit, IndexedDB o
                            backup.
                          </p>
                        </div>
                        <button class="btn soft full" onClick={reset}>
                          ↻ Ripristina dati demo
                        </button>
                        <button class="btn soft full" onClick={() => open('goal')}>
                          ＋ Aggiungi un nuovo obiettivo
                        </button>
                      </Card>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
      <nav class="mobile-nav" aria-label="Navigazione mobile">
        {nav.map((item) => (
          <button
            data-page={item.id}
            key={item.id}
            onClick={() => setPage(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            class={page === item.id ? 'active' : ''}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.short}</small>
          </button>
        ))}
      </nav>
      {dialog && data && (
        <DialogForm
          key={dialog.kind + String(dialog.id ?? 'new')}
          dialog={dialog}
          data={data}
          day={day}
          close={() => setDialog(undefined)}
          save={save}
          error={message}
        />
      )}
      {busy && (
        <div class="saving" role="status">
          Salvataggio demo…
        </div>
      )}
    </div>
  );
}
