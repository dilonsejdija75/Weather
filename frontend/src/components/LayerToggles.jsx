import { Cloud, CloudRain, ThermometerSimple, Wind } from "@phosphor-icons/react";

const LAYERS = [
  { key: "clouds", label: "CLOUDS", Icon: Cloud },
  { key: "precipitation", label: "RAIN", Icon: CloudRain },
  { key: "temp", label: "TEMP", Icon: ThermometerSimple },
  { key: "wind", label: "WIND", Icon: Wind },
];

export default function LayerToggles({ active, onToggle }) {
  return (
    <div className="glass-panel p-2 flex flex-col gap-1" data-testid="layer-toggles">
      <div className="overline px-2 pt-1 pb-2">OVERLAYS</div>
      {LAYERS.map(({ key, label, Icon }) => (
        <button
          key={key}
          data-testid={`layer-toggle-${key}`}
          data-state={active[key] ? "on" : "off"}
          onClick={() => onToggle(key)}
          className="btn-radar flex items-center gap-2 px-3 py-2 justify-start"
        >
          <Icon size={14} weight="duotone" />
          {label}
        </button>
      ))}
    </div>
  );
}
