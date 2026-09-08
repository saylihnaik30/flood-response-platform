import { useState, useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  Loader2,
  LocateFixed,
  MapPin,
  Send,
  X,
} from 'lucide-react';
import { supabase, type NeedType } from '@/lib/supabase';
import { NEED_TYPES } from '@/lib/constants';

export default function ReportPage() {
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [needType, setNeedType] = useState<NeedType | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUseLocation = () => {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Location is not supported by your browser. Please enter your location manually.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. You can still enter your location manually below.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('Your location is unavailable right now. Please enter your location manually.');
        } else {
          setLocationError('Could not get your location. Please enter it manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    setError(null);

    if (!location.trim()) {
      setError('Please enter your location so responders can find you.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe your situation.');
      return;
    }
    if (!needType) {
      setError('Please select what kind of help you need.');
      return;
    }

    setSubmitting(true);

    let photoUrl: string | null = null;

    if (photoFile) {
      const ext = photoFile.name.split('.').pop() ?? 'jpg';
      const fileName = `reports/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(fileName, photoFile);
      if (uploadError) {
        photoUrl = null;
      } else {
        const { data } = supabase.storage
          .from('report-photos')
          .getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }
    }

    // Call the server-side scoring edge function
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-report`;
    let insertError = false;
    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          location: location.trim(),
          description: description.trim(),
          need_type: needType,
          photo_url: photoUrl,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });
      if (!response.ok) {
        insertError = true;
      }
    } catch {
      insertError = true;
    }

    setSubmitting(false);

    if (insertError) {
      setError('Something went wrong sending your report. Please try again.');
      return;
    }

    setSubmitted(true);
  };

  const resetForm = () => {
    setLocation('');
    setDescription('');
    setNeedType(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setCoords(null);
    setLocationError(null);
    setSubmitted(false);
    setError(null);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 to-teal-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-10 text-center animate-[fadeIn_0.4s_ease-out]">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-11 h-11 text-green-600" strokeWidth={2} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-3">
            Report received.
          </h2>
          <p className="text-xl text-green-700 font-medium mb-2">
            Help is on the way.
          </p>
          <p className="text-slate-500 mb-8">
            Your report has been sent to the response team. Stay safe and keep
            your phone nearby — responders will reach out as soon as they can.
          </p>
          <button
            onClick={resetForm}
            className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-2xl transition-colors text-lg"
          >
            Send Another Report
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 mt-4 text-teal-600 hover:text-teal-700 font-medium"
          >
            View Responder Dashboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-teal-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-sm border-b border-sky-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
              <CloudRain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">
                FloodPulse
              </h1>
              <p className="text-xs text-slate-500">Citizen Emergency Report</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            Dashboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main form */}
      <main className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">
              Report Your Situation
            </h2>
            <p className="text-slate-500">
              Tell us where you are and what you need. This goes directly to the
              emergency response team.
            </p>
          </div>

          {/* Location */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Where are you?
            </label>

            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="w-full mb-3 py-3 px-4 bg-teal-50 border-2 border-teal-200 rounded-2xl text-teal-700 font-semibold flex items-center justify-center gap-2 hover:bg-teal-100 hover:border-teal-300 transition-colors disabled:opacity-60"
            >
              {locating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Getting your location...
                </>
              ) : (
                <>
                  <LocateFixed className="w-5 h-5" />
                  Use My Current Location
                </>
              )}
            </button>

            {coords && (
              <div className="mb-3 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl">
                <MapPin className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-800 font-medium">
                  Location captured: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="ml-auto text-green-600 hover:text-green-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {locationError && (
              <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-medium">
                {locationError}
              </div>
            )}

            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter your location (area, landmark, address)"
                className="w-full pl-12 pr-4 py-4 text-lg bg-sky-50 border-2 border-sky-100 rounded-2xl focus:border-sky-400 focus:outline-none transition-colors text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Use the button above to share your exact coordinates, or type your location manually. Coordinates help responders match you to the nearest resource.
            </p>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              What's happening?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your situation — water level, number of people, any injuries, how to reach you..."
              rows={4}
              className="w-full px-4 py-4 text-lg bg-sky-50 border-2 border-sky-100 rounded-2xl focus:border-sky-400 focus:outline-none transition-colors text-slate-800 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Need type */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              What do you need?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {NEED_TYPES.map((nt) => {
                const Icon = nt.icon;
                const selected = needType === nt.key;
                return (
                  <button
                    key={nt.key}
                    type="button"
                    onClick={() => setNeedType(nt.key)}
                    className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all ${
                      selected
                        ? 'border-teal-500 bg-teal-50 shadow-md scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50'
                    }`}
                  >
                    <Icon
                      className={`w-8 h-8 ${
                        selected ? 'text-teal-600' : 'text-slate-400'
                      }`}
                      strokeWidth={2}
                    />
                    <span
                      className={`font-bold text-lg ${
                        selected ? 'text-teal-700' : 'text-slate-700'
                      }`}
                    >
                      {nt.label}
                    </span>
                    <span className="text-xs text-slate-400 text-center">
                      {nt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Add a photo <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            {photoPreview ? (
              <div className="relative inline-block">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full max-w-xs h-40 object-cover rounded-2xl border-2 border-sky-100"
                />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-sky-200 rounded-2xl bg-sky-50/50 hover:bg-sky-50 hover:border-sky-300 transition-colors flex flex-col items-center gap-2 text-sky-500"
              >
                <Camera className="w-8 h-8" />
                <span className="font-medium">Tap to upload a photo</span>
                <span className="text-xs text-slate-400">
                  Shows responders exactly what you see
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-bold text-lg rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Sending Report...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Report
              </>
            )}
          </button>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Your report is sent securely to the FloodPulse response team.
        </p>
      </main>
    </div>
  );
}
