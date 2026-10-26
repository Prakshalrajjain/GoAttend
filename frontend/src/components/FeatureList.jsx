
const features = [
  { icon: '◎', label: 'GPS Verification' },
  { icon: '▣', label: 'Photo Verification' },
  { icon: '✓', label: 'Secure Records' },
]

function FeatureList() {
  return (
    <div className="features">
      {features.map((feature) => (
        <div className="feature" key={feature.label}>
          <span className="feature-icon">{feature.icon}</span>
          <span>{feature.label}</span>
        </div>
      ))}
    </div>
  )
}

export default FeatureList
