export function PulsarBackground() {
  return (
    <div className="pulsar-canvas-container" aria-hidden="true">
      <div className="pulsar-comic-dots" />

      <svg
        className="pulsar-svg-root"
        viewBox="0 0 600 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="300" cy="300" r="80" className="pulsar-ring pulsar-ring-1" />
        <circle cx="300" cy="300" r="140" className="pulsar-ring pulsar-ring-accent pulsar-ring-2" />
        <circle cx="300" cy="300" r="200" className="pulsar-ring pulsar-ring-3" />
        <circle cx="300" cy="300" r="260" className="pulsar-ring pulsar-ring-accent pulsar-ring-4" />

        <circle cx="300" cy="300" r="45" stroke="#000000" strokeWidth="4" />
        <circle cx="300" cy="300" r="25" className="pulsar-core-dot" />
        <circle cx="300" cy="300" r="10" className="pulsar-core-center" />
      </svg>

      <svg
        className="pulsar-svg-left"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="250" cy="250" r="60" className="pulsar-ring pulsar-ring-1" />
        <circle cx="250" cy="250" r="120" className="pulsar-ring pulsar-ring-yellow pulsar-ring-2" />
        <circle cx="250" cy="250" r="180" className="pulsar-ring pulsar-ring-accent pulsar-ring-3" />
        <circle cx="250" cy="250" r="240" className="pulsar-ring pulsar-ring-4" />
        <circle cx="250" cy="250" r="20" fill="#000000" stroke="#FFE600" strokeWidth="4" />
      </svg>

      <div className="comic-sparkle sparkle-1">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#FFE600" stroke="#000000" strokeWidth="2.5">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
        </svg>
      </div>

      <div className="comic-sparkle sparkle-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#00F0FF" stroke="#000000" strokeWidth="2.5">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
        </svg>
      </div>

      <div className="comic-sparkle sparkle-3">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#8B5CF6" stroke="#000000" strokeWidth="2.5">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
        </svg>
      </div>
    </div>
  )
}

export default PulsarBackground
