import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

const MIN_PRESSURE = 0.1;
const MAX_PRESSURE = 1000;
const LOG_MIN = Math.log10(MIN_PRESSURE); // -1
const LOG_MAX = Math.log10(MAX_PRESSURE); // 3
const LOG_RANGE = LOG_MAX - LOG_MIN;       // 4

// Arc: 270° sweep, gap at the bottom
// Angles measured clockwise from 12 o'clock (0° = top)
const START_ANGLE = 225; // ~7:30 position (lower-left)
const SWEEP = 270;       // ends at 225+270 = 495° = 135° (~4:30, lower-right)

// Color zones (each = 1 logarithmic decade = 25% of arc)
const ZONES = [
  { from: 0.1, to: 1,    color: "#4ADE80" }, // Green — good vacuum
  { from: 1,   to: 10,   color: "#FACC15" }, // Yellow — marginal
  { from: 10,  to: 100,  color: "#FB923C" }, // Orange — poor
  { from: 100, to: 1000, color: "#F87171" }, // Red — vacuum loss
];

const TICKS = [0.1, 1, 10, 100, 1000];

function pressureToAngle(pressure) {
  const clamped = Math.max(MIN_PRESSURE, Math.min(MAX_PRESSURE, pressure));
  const normalized = (Math.log10(clamped) - LOG_MIN) / LOG_RANGE;
  return START_ANGLE + normalized * SWEEP;
}

// Convert clock-style angle to SVG cartesian coordinates
// 0° = 12 o'clock (top), 90° = 3 o'clock (right), clockwise
function toXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = toXY(cx, cy, r, startDeg);
  const e = toXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function VacuumGauge({ pressure }) {
  const svgW = 300;
  const svgH = 240;
  const cx = svgW / 2;
  const cy = 135;
  const R = 100;           // arc centerline radius
  const arcThick = 22;     // arc band width

  const hasPressure = pressure != null && pressure > 0;
  const needleAngle = hasPressure ? pressureToAngle(pressure) : START_ANGLE;

  // Format display value — always two decimal places
  const displayValue = hasPressure ? pressure.toFixed(2) : "—";

  return (
    <View style={styles.container}>
      <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>

        {/* Background arc (dark track) */}
        <Path
          d={arcPath(cx, cy, R, START_ANGLE, START_ANGLE + SWEEP)}
          stroke="#1E293B"
          strokeWidth={arcThick + 2}
          fill="none"
          strokeLinecap="round"
        />

        {/* Colored zone arcs */}
        {ZONES.map((zone, i) => (
          <Path
            key={i}
            d={arcPath(cx, cy, R, pressureToAngle(zone.from), pressureToAngle(zone.to))}
            stroke={zone.color}
            strokeWidth={arcThick}
            fill="none"
            strokeLinecap="butt"
          />
        ))}

        {/* Major tick marks + labels */}
        {TICKS.map((tick) => {
          const a = pressureToAngle(tick);
          const outer = toXY(cx, cy, R + arcThick / 2 + 2, a);
          const inner = toXY(cx, cy, R + arcThick / 2 - 6, a);
          const lbl = toXY(cx, cy, R + arcThick / 2 + 18, a);
          const label = tick < 1 ? tick.toFixed(1) : String(tick);
          return (
            <G key={tick}>
              <Line
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <SvgText
                x={lbl.x} y={lbl.y}
                fontSize={12}
                fontWeight="600"
                fill="#6B7280"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {label}
              </SvgText>
            </G>
          );
        })}

        {/* Minor tick marks */}
        {[0.2, 0.3, 0.5, 2, 3, 5, 20, 30, 50, 200, 300, 500].map((tick) => {
          const a = pressureToAngle(tick);
          const outer = toXY(cx, cy, R + arcThick / 2 + 1, a);
          const inner = toXY(cx, cy, R + arcThick / 2 - 3, a);
          return (
            <Line
              key={tick}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="#FFFFFF"
              strokeWidth={1}
            />
          );
        })}

        {/* Needle */}
        {hasPressure && (
          <>
            <Line
              x1={cx} y1={cy}
              x2={toXY(cx, cy, R - arcThick / 2 - 6, needleAngle).x}
              y2={toXY(cx, cy, R - arcThick / 2 - 6, needleAngle).y}
              stroke="#93C5FD"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </>
        )}

        {/* Center pivot */}
        <Circle cx={cx} cy={cy} r={6} fill="#D1D5DB" />
        <Circle cx={cx} cy={cy} r={3} fill="#6B7280" />

        {/* Digital readout inside the arc */}
        <SvgText
          x={cx} y={cy + 30}
          fontSize={32}
          fontWeight="bold"
          fill="#111827"
          textAnchor="middle"
        >
          {displayValue}
        </SvgText>
        <SvgText
          x={cx} y={cy + 50}
          fontSize={14}
          fill="#6B7280"
          textAnchor="middle"
        >
          mbar
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
});
