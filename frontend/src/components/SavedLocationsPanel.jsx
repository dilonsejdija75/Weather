import { BookmarkSimple, Trash, MapPin, X } from "@phosphor-icons/react";

export default function SavedLocationsPanel({ saved, open, onClose, onSelect, onRemove }) {
  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          data-testid="saved-backdrop"
        />
      )}
      <aside
        data-testid="saved-panel"
        className={`fixed top-0 right-0 h-full w-[320px] max-w-[88vw] z-50 transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="glass-panel h-full flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <div className="overline">SAVED</div>
              <h3 className="font-display text-lg tracking-tight uppercase text-white">
                Locations
              </h3>
            </div>
            <button
              onClick={onClose}
              data-testid="saved-close"
              className="text-white/60 hover:text-white"
              aria-label="Close saved locations"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {saved.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <BookmarkSimple size={48} weight="duotone" className="text-white/20 mb-3" />
              <div className="font-display text-sm uppercase tracking-wider text-white/70">
                No saved locations
              </div>
              <div className="overline mt-2 max-w-[220px]">
                Click anywhere on the map, then tap SAVE LOCATION to pin it here.
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {saved.map((loc) => (
                <div
                  key={`${loc.lat}-${loc.lon}`}
                  data-testid={`saved-item-${loc.lat.toFixed(3)}-${loc.lon.toFixed(3)}`}
                  className="group flex items-center gap-3 px-5 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <button
                    onClick={() => onSelect(loc)}
                    className="flex-1 text-left flex items-start gap-2"
                  >
                    <MapPin size={16} weight="duotone" className="text-[#e2ff3b] mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-display text-sm tracking-tight text-white truncate">
                        {loc.name || "Unnamed"}
                      </div>
                      <div className="overline mt-0.5">
                        {loc.country || "—"} · {loc.lat.toFixed(3)}, {loc.lon.toFixed(3)}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => onRemove(loc.lat, loc.lon)}
                    data-testid={`saved-remove-${loc.lat.toFixed(3)}-${loc.lon.toFixed(3)}`}
                    className="text-white/40 hover:text-[#ff3333] transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Remove saved location"
                  >
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
