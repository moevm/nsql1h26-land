import { scoreColor } from '../utils';

interface ScoreGaugeProps {
  readonly value: number;
  readonly size?: number;
  readonly label?: string;
  readonly color?: string;
}

export default function ScoreGauge({ value, size = 44, label, color }: ScoreGaugeProps) {
  const r = (size - (size > 60 ? 8 : 6)) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value);
  const strokeWidth = size > 60 ? 4 : 3;
  const resolvedColor = color ?? scoreColor(value);

  return (
    <div className={label ? 'flex flex-col items-center gap-1' : undefined}>
      <svg width={size} height={size} className="gauge-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--c-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset var(--motion-duration) var(--motion-ease)' }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: resolvedColor,
            fontSize: size * (size > 60 ? 0.28 : 0.26),
            fontFamily: 'var(--font-mono)',
            fontWeight: size > 60 ? 700 : 600,
          }}
        >
          {(value * 100).toFixed(0)}
        </text>
      </svg>
      {label && (
        <span
          className="text-xs"
          style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
