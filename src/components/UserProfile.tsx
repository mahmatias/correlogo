import { useState, useEffect } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Modal from './Modal';
import Button from './Button';
import { ProfileData, SettingsData, BRAZILIAN_STATES, GENDER_OPTIONS } from '../types';
import { getDb } from '../lib/firebase';

interface UserProfileProps {
  open: boolean;
  onClose: () => void;
  user: User;
  initialProfile: ProfileData | null;
  initialSettings: SettingsData | null;
  showFeedback: (type: 'success' | 'error', message: string) => void;
  onSaved: (profile: ProfileData, settings: SettingsData) => void;
}

export default function UserProfile({
  open,
  onClose,
  user,
  initialProfile,
  initialSettings,
  showFeedback,
  onSaved,
}: UserProfileProps) {
  const [displayName, setDisplayName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [paceUnit, setPaceUnit] = useState<'per_km' | 'per_mi'>('per_km');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');

  useEffect(() => {
    if (!open) return;

    setDisplayName(initialProfile?.displayName ?? '');
    setCity(initialProfile?.city ?? '');
    setState(initialProfile?.state ?? '');
    setGender(initialProfile?.gender ?? '');

    if (initialProfile?.dob) {
      const [y, m, d] = initialProfile.dob.split('-');
      setYear(y);
      setMonth(m);
      setDay(d);
    } else {
      setDay('');
      setMonth('');
      setYear('');
    }

    const wUnit = initialSettings?.weightUnit ?? 'kg';
    setWeightUnit(wUnit);
    if (initialProfile?.weightInKg != null) {
      if (wUnit === 'lb') {
        setWeightInput((initialProfile.weightInKg * 2.20462).toFixed(1));
      } else {
        setWeightInput(String(initialProfile.weightInKg));
      }
    } else {
      setWeightInput('');
    }

    setDistanceUnit(initialSettings?.distanceUnit ?? 'km');
    setPaceUnit(initialSettings?.paceUnit ?? 'per_km');
  }, [open]);

  const handleWeightUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as 'kg' | 'lb';
    if (weightInput) {
      const val = parseFloat(weightInput);
      if (!isNaN(val)) {
        if (newUnit === 'lb') {
          setWeightInput((val * 2.20462).toFixed(1));
        } else {
          setWeightInput((val / 2.20462).toFixed(1));
        }
      }
    }
    setWeightUnit(newUnit);
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const parsedWeight = weightInput ? parseFloat(weightInput) : null;
      const weightInKg = (parsedWeight && weightUnit === 'lb')
        ? parseFloat((parsedWeight / 2.20462).toFixed(2))
        : parsedWeight;

      const dobStr = day && month && year ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : null;
      const profile: ProfileData = {
        displayName,
        dob: dobStr,
        gender: gender || null,
        city: city || null,
        state: state || null,
        photoURL: user.photoURL || null,
        weightInKg,
        updatedAt: Date.now(),
      };

      const settings: SettingsData = {
        isDarkMode: initialSettings?.isDarkMode ?? false,
        distanceUnit,
        paceUnit,
        weightUnit,
      };

      const db = getDb();
      await setDoc(doc(db, 'users', user.uid, 'data', 'profile'), profile, { merge: true });
      await setDoc(doc(db, 'users', user.uid, 'data', 'settings'), settings, { merge: true });

      await updateProfile(user, { displayName });

      localStorage.setItem(`correlogo:profile:${user.uid}`, JSON.stringify(profile));
      localStorage.setItem(`correlogo:settings:${user.uid}`, JSON.stringify(settings));

      showFeedback('success', 'Perfil salvo');
      onSaved(profile, settings);
      onClose();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Erro ao salvar perfil');
    }
  };

  const initial = displayName ? displayName[0] : (user.email?.[0] ?? '?');

  return (
    <Modal open={open} onClose={onClose} title="Perfil">
      <div className="flex justify-center mb-4">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
            {initial.toUpperCase()}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Nome</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full p-2 rounded-lg bg-bg-elevated text-text-primary border border-border"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Data de Nascimento</label>
        <div className="flex gap-2">
          <select value={day} onChange={(e) => setDay(e.target.value)} className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
            <option value="">Dia</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
            <option value="">Mês</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
            <option value="">Ano</option>
            {Array.from({ length: 2026 - 1900 + 1 }, (_, i) => {
              const y = 1900 + i;
              return <option key={y} value={String(y)}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Gênero</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
          <option value="">Selecionar</option>
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Cidade</label>
        <input
          type="text"
          value={city}
          maxLength={20}
          onChange={(e) => setCity(e.target.value)}
          className="w-full p-2 rounded-lg bg-bg-elevated text-text-primary border border-border"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Estado</label>
        <select value={state} onChange={(e) => setState(e.target.value)} className="w-full p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
          <option value="">Selecionar</option>
          {BRAZILIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Peso</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            step="0.1"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border"
          />
          <span className="text-text-muted text-sm">{weightUnit === 'kg' ? 'kg' : 'lb'}</span>
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-text-muted mb-1">Unidades</label>
        <div className="flex gap-2">
          <select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value as 'km' | 'mi')} className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
          <select value={paceUnit} onChange={(e) => setPaceUnit(e.target.value as 'per_km' | 'per_mi')} className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
            <option value="per_km">/km</option>
            <option value="per_mi">/mi</option>
          </select>
          <select value={weightUnit} onChange={handleWeightUnitChange} className="flex-1 p-2 rounded-lg bg-bg-elevated text-text-primary border border-border">
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
      </div>

      <Button variant="primary" className="w-full mt-4" onClick={handleSave}>Salvar</Button>
    </Modal>
  );
}
