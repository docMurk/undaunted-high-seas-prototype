// SVG <defs> shared by all tiles. Rendered once at the root SVG.
import React from 'react';

export default function TileDefs() {
  return (
    <defs>
      {/* Water gradient */}
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stopColor="#1a4a72" />
        <stop offset="100%" stopColor="#0f2c47" />
      </linearGradient>

      {/* Subtle water turbulence */}
      <filter id="waterNoise" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3" />
        <feColorMatrix values="0 0 0 0 0.18
                                0 0 0 0 0.32
                                0 0 0 0 0.50
                                0 0 0 0.10 0" />
        <feComposite in2="SourceGraphic" operator="in" />
        <feComposite in="SourceGraphic" operator="over" />
      </filter>

      {/* Sand pattern: tan base + subtle stipple (used for ISLANDS) */}
      <pattern id="sandPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#d8b783" />
        <circle cx="2" cy="3" r="0.7" fill="#a8855a" opacity="0.55" />
        <circle cx="6" cy="6" r="0.6" fill="#a8855a" opacity="0.45" />
        <circle cx="5" cy="1.5" r="0.4" fill="#7a5e3d" opacity="0.40" />
      </pattern>

      {/* Coast pattern: green grass + subtle texture (used for COASTLINES) */}
      <pattern id="coastPattern" x="0" y="0" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#558b3a" />
        <circle cx="2" cy="3" r="0.7" fill="#3d6a26" opacity="0.55" />
        <circle cx="6" cy="6" r="0.6" fill="#3d6a26" opacity="0.50" />
        <circle cx="5" cy="1.5" r="0.5" fill="#76a85a" opacity="0.55" />
        <circle cx="1.5" cy="7" r="0.5" fill="#76a85a" opacity="0.50" />
      </pattern>

      {/* Rock pattern: gray with hatching */}
      <pattern id="rockPattern" x="0" y="0" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#7d7e80" />
        <circle cx="2" cy="2" r="1.1" fill="#5a5b5d" opacity="0.7" />
        <circle cx="6" cy="5" r="0.9" fill="#9a9c9e" opacity="0.6" />
        <line x1="0" y1="8" x2="9" y2="8" stroke="#4d4e50" strokeWidth="0.6" opacity="0.5" />
      </pattern>

      {/* Reef pattern: pale teal with dotted highlights */}
      <pattern id="reefPattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#5d8a8a" />
        <circle cx="2" cy="2" r="0.8" fill="#a5c8c8" opacity="0.7" />
        <circle cx="7" cy="5" r="0.7" fill="#a5c8c8" opacity="0.6" />
        <circle cx="5" cy="8" r="0.6" fill="#3f6868" opacity="0.55" />
      </pattern>

      {/* Fog: turbulent overlay clipped to source shape via feComposite "in" */}
      <filter id="fogNoise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" result="noise" />
        <feColorMatrix in="noise" values="0 0 0 0 1
                                           0 0 0 0 1
                                           0 0 0 0 1
                                           0 0 0 0.55 0" result="white-noise" />
        <feComposite in="white-noise" in2="SourceGraphic" operator="in" />
      </filter>

      {/* Fort glyph: small bastion with central star */}
      <symbol id="fortGlyph" viewBox="-12 -12 24 24">
        {/* shadow */}
        <polygon
          points="-9,-2 -9,7 9,7 9,-2 5,-2 5,-7 -5,-7 -5,-2"
          fill="#1a1a1d" opacity="0.55"
          transform="translate(0.6, 0.8)"
        />
        {/* body */}
        <polygon
          points="-9,-2 -9,7 9,7 9,-2 5,-2 5,-7 -5,-7 -5,-2"
          fill="#2a2b2e" stroke="#f5e6c8" strokeWidth="0.8"
        />
        {/* crenellations */}
        <rect x="-9" y="-3.5" width="2.5" height="2" fill="#2a2b2e" stroke="#f5e6c8" strokeWidth="0.6" />
        <rect x="-3" y="-3.5" width="2.5" height="2" fill="#2a2b2e" stroke="#f5e6c8" strokeWidth="0.6" />
        <rect x="0.5" y="-3.5" width="2.5" height="2" fill="#2a2b2e" stroke="#f5e6c8" strokeWidth="0.6" />
        <rect x="6.5" y="-3.5" width="2.5" height="2" fill="#2a2b2e" stroke="#f5e6c8" strokeWidth="0.6" />
        {/* central star */}
        <polygon
          points="0,-5 1.4,-1.4 5,-0.6 2.2,1.7 3,5 0,3.1 -3,5 -2.2,1.7 -5,-0.6 -1.4,-1.4"
          fill="#f5e6c8"
        />
      </symbol>

      {/* Selected-ring filter (subtle) */}
      <filter id="selectGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" />
      </filter>
    </defs>
  );
}
