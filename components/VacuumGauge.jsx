import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

/**
 * VacuumGauge — logarithmic vacuum gauge (0.1–1000 mbar).
 *
 * React Native port of the web app's VacuumGauge2, so the two look identical:
 * 240° arc, green below the limit / red above, filled triangular needle,
 * threshold marker, and IBM Plex Mono readout (loaded in app/_layout.jsx).
 *
 * Differences from the web component, both intentional:
 *   - No animation — the needle snaps to the value (matches prior mobile
 *     behaviour and avoids per-frame SVG re-renders on the polling dashboard).
 *   - Offline state — when `pressure` is null/≤0 the dial still renders but
 *     the value shows "—" and the needle is hidden.
 *
 * Prop is `pressure` (unchanged from the previous gauge) so both callsites
 * keep working untouched.
 */

const MONO_REG = "IBMPlexMono-Regular";
const MONO_SEMI = "IBMPlexMono-SemiBold";
const GREEN = "#5BB85C";
const RED = "#E25141";

const MIN = 0.1;
const MAX = 1000;
const LMIN = Math.log10(MIN);
const LMAX = Math.log10(MAX);
const tOf = (v) => (Math.log10(v) - LMIN) / (LMAX - LMIN);

// ---- SVG geometry (verbatim from the web design) ----
const cx = 115, cy = 118, R = 80, tw = 13;
const a0 = -120, span = 240;
const ang = (t) => a0 + t * span;
const pol = (r, a) => {
  const rad = (a * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
};
const arc = (r, x0a, x1a) => {
  const [x0, y0] = pol(r, x0a);
  const [x1, y1] = pol(r, x1a);
  const large = Math.abs(x1a - x0a) > 180 ? 1 : 0;
  const sweep = x1a > x0a ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const DECADE_LABELS = ["0.1", "1", "10", "100", "1000"];
const DECS = [0, 0.25, 0.5, 0.75, 1];

export default function VacuumGauge({ pressure, limit = 2 }) {
  const hasPressure = pressure != null && pressure > 0;
  const value = hasPressure ? pressure : MIN;

  const targetT = Math.max(0, Math.min(1, tOf(value)));
  const tLimit = Math.max(0, Math.min(1, tOf(limit)));
  const na = ang(targetT);

  const valueLabel = !hasPressure
    ? "—"
    : value >= 100 ? value.toFixed(0)
    : value >= 10 ? value.toFixed(1)
    : value >= 1 ? value.toFixed(2)
    : value >= 0.001 ? value.toFixed(3)
    : value.toExponential(1);

  // Minor ticks (2×–9× each decade, capped at MAX).
  const minorTicks = [];
  for (let d = 0; d < 4; d++) {
    for (let m = 2; m <= 9; m++) {
      const v = MIN * Math.pow(10, d) * m;
      if (v > MAX) break;
      const a = ang(tOf(v));
      const [x1, y1] = pol(R + tw / 2 - 5, a);
      const [x2, y2] = pol(R + tw / 2, a);
      minorTicks.push(
        <Line key={`mn${d}-${m}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={0.9} opacity={0.5} />
      );
    }
  }

  // Decade ticks + labels.
  const decadeTicks = DECS.flatMap((t, i) => {
    const a = ang(t);
    const [x1, y1] = pol(R - tw / 2, a);
    const [x2, y2] = pol(R + tw / 2, a);
    const [lx, ly] = pol(R + tw / 2 + 12, a);
    return [
      <Line key={`mt${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={1.6} />,
      <SvgText key={`dl${i}`} x={lx} y={ly + 3.5} textAnchor="middle" fontSize={10.5} fill="#8a96a3" fontFamily={MONO_REG}>{DECADE_LABELS[i]}</SvgText>,
    ];
  });

  // Threshold marker.
  const thA = ang(tLimit);
  const [thx1, thy1] = pol(R - tw / 2 - 3, thA);
  const [thx2, thy2] = pol(R + tw / 2 + 5, thA);
  const [thlx, thly] = pol(R + tw / 2 + 13, thA);

  return (
    <View style={styles.container}>
      <Svg width={300} height={240} viewBox="-5 -5 240 192">
        <Path d={arc(R, ang(0), ang(tLimit) - 1.4)} stroke={GREEN} strokeWidth={tw} fill="none" />
        <Path d={arc(R, ang(tLimit) + 1.4, ang(1))} stroke={RED} strokeWidth={tw} fill="none" />

        {minorTicks}
        {decadeTicks}

        <Line x1={thx1} y1={thy1} x2={thx2} y2={thy2} stroke="#2b3440" strokeWidth={2.6} strokeLinecap="round" />
        <SvgText x={thlx} y={thly + 3.5} textAnchor="middle" fontSize={11} fill="#2b3440" fontFamily={MONO_SEMI}>{limit}</SvgText>

        {hasPressure && (
          <G rotation={na} originX={cx} originY={cy}>
            <Path d={`M ${cx} ${cy - (R - tw / 2 + 4)} L ${cx - 3} ${cy + 8} L ${cx + 3} ${cy + 8} Z`} fill="#2b3440" />
            <Circle cx={cx} cy={cy} r={7.5} fill="#2b3440" />
            <Circle cx={cx} cy={cy} r={3} fill="#fff" />
          </G>
        )}

        <SvgText
          x={cx} y={cy + 38}
          textAnchor="middle"
          fontSize={34}
          fill="#1f2a37"
          fontFamily={MONO_SEMI}
          letterSpacing={-1}
        >
          {valueLabel}
        </SvgText>
        <SvgText
          x={cx} y={cy + 53}
          textAnchor="middle"
          fontSize={10.5}
          fill="#8a96a3"
          fontFamily={MONO_REG}
          letterSpacing={0.4}
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
