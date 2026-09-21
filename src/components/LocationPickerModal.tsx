import React, { useState, useEffect } from "react";
import { MapPin, Navigation, X, Check, ExternalLink, AlertCircle, Compass } from "lucide-react";

interface LocationPickerModalProps {
  onSendLocation: (data: { latitude: number; longitude: number; address: string }) => void;
  onClose: () => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  onSendLocation,
  onClose,
}) => {
  const [lat, setLat] = useState<number>(37.7749);
  const [lng, setLng] = useState<number>(-122.4194);
  const [label, setLabel] = useState<string>("San Francisco, CA");
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detectedLat = Number(pos.coords.latitude.toFixed(5));
        const detectedLng = Number(pos.coords.longitude.toFixed(5));
        setLat(detectedLat);
        setLng(detectedLng);
        setLabel("My Current Location");
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setError("Unable to retrieve your location. You can enter or pick coordinates manually.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    onSendLocation({
      latitude: lat,
      longitude: lng,
      address: label || `${lat}, ${lng}`,
    });
    onClose();
  };

  // Static preview map using OpenStreetMap
  const mapPreviewUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=14&l=map&size=450,220&pt=${lng},${lat},pm2rdm`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        id="location-picker-modal"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-orange-200 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Share Location</h2>
              <p className="text-xs text-neutral-500">Send real-time GPS coordinates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Map Preview Banner */}
        <div className="mt-4 relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 h-44 flex items-center justify-center">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
            className="w-full h-full pointer-events-none"
          />

          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-bold text-orange-700 shadow-xs border border-orange-200 flex items-center gap-1">
            <Compass className="w-3 h-3 text-orange-600 animate-spin" />
            <span>Lat: {lat} • Lng: {lng}</span>
          </div>
        </div>

        {/* Actions & Inputs */}
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={detectLocation}
              disabled={isLocating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs hover:bg-orange-100 cursor-pointer transition-all disabled:opacity-50"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isLocating ? "Detecting GPS..." : "Re-detect Current GPS"}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Location Label / Address
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Home, Office, Central Park"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:border-orange-500 text-neutral-900 text-xs outline-hidden"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-600 font-semibold text-xs hover:bg-neutral-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="confirm-send-location-btn"
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Attach Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
