interface BrandHeaderProps {
  tagline: string;
  description: string;
}

export default function BrandHeader({ tagline, description }: BrandHeaderProps) {
  return (
    <header className="bv-header">
      <div className="bv-brand">
        <span className="bv-brand-mark" aria-hidden="true">B</span>
        <div className="bv-brand-copy">
          <span className="bv-brand-name">BharatVoice</span>
          <span className="bv-tagline">{tagline}</span>
        </div>
      </div>
      <p className="bv-description">{description}</p>
    </header>
  );
}
